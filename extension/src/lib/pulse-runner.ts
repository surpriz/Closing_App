import { browser } from "wxt/browser";

import { api, getToken } from "./api";
import { alertsToShow, badgeText, pruneSnoozes, rememberSeen, SNOOZE_MS, type Pulse, type PulseReader } from "./pulse";

// Runs in the background service worker. Every 30 s (the shortest MV3 alarm)
// it asks the app who is reading and what deserves a notification.

export const PULSE_ALARM = "clozer-pulse";
const NOTICE_PREFIX = "clozer:";
const BADGE_COLOR = "#c2410c";

// storage.session: cleared when the browser closes, never synced
const SINCE = "pulseSince";
const SEEN = "pulseSeen";
const READERS = "pulseReaders";
const NOTICES = "pulseNotices";
const SNOOZED = "pulseSnoozed";
// storage.local: the popup switch, kept across restarts
export const CALL_MOMENTS_KEY = "callMoments";

type Notices = Record<string, { url: string; linkId: string }>;

export async function getCallMoments() {
  const stored = await browser.storage.local.get(CALL_MOMENTS_KEY);
  return stored[CALL_MOMENTS_KEY] !== false;
}

export async function startPulse() {
  await browser.alarms.create(PULSE_ALARM, { periodInMinutes: 0.5, delayInMinutes: 0.1 });
}

export async function stopPulse() {
  await browser.alarms.clear(PULSE_ALARM);
  await browser.action.setBadgeText({ text: "" });
  await browser.storage.session.remove([SINCE, READERS]);
}

export async function lastReaders(): Promise<PulseReader[]> {
  const stored = await browser.storage.session.get(READERS);
  return (stored[READERS] as PulseReader[] | undefined) ?? [];
}

let running = false;

export async function pulse() {
  if (running) return;
  running = true;
  try {
    if (!(await getToken())) return stopPulse();
    // Screen locked: nobody to call, and no need to wake the server
    if ((await browser.idle.queryState(5 * 60)) === "locked") return;

    const stored = await browser.storage.session.get([SINCE, SEEN, NOTICES, SNOOZED]);
    const since = stored[SINCE] as string | undefined;
    const data = await api<Pulse>(`/api/ext/pulse${since ? `?since=${encodeURIComponent(since)}` : ""}`);

    await browser.storage.session.set({ [SINCE]: data.next, [READERS]: data.readers });
    await browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    await browser.action.setBadgeText({ text: data.enabled ? badgeText(data.readers) : "" });
    await browser.action.setTitle({
      title: data.readers.length ? `Clozer · en train de lire : ${[...new Set(data.readers.map((r) => r.label))].join(", ")}` : "Clozer",
    });
    if (!data.enabled) return;

    const now = Date.now();
    const snoozed = pruneSnoozes((stored[SNOOZED] as Record<string, number> | undefined) ?? {}, now);
    const seen = (stored[SEEN] as string[] | undefined) ?? [];
    const notices = (stored[NOTICES] as Notices | undefined) ?? {};
    const show = alertsToShow(data.alerts, { seen, snoozed, callMoments: await getCallMoments() }, now);

    for (const alert of show) {
      const id = `${NOTICE_PREFIX}${alert.id}`;
      notices[id] = { url: alert.url, linkId: alert.linkId };
      await browser.notifications.create(id, {
        type: "basic",
        iconUrl: browser.runtime.getURL("/icon/128.png"),
        title: alert.title,
        message: alert.body,
        priority: alert.priority === "ACTION" ? 2 : 1,
        // A validation waits on screen; a call moment fades with the moment
        requireInteraction: alert.priority === "ACTION",
        buttons: alert.priority === "ACTION" ? [{ title: "Ouvrir" }] : [{ title: "Ouvrir" }, { title: "Plus tard" }],
      });
    }

    await browser.storage.session.set({
      [SEEN]: rememberSeen(seen, data.alerts.map((a) => a.id)),
      [NOTICES]: Object.fromEntries(Object.entries(notices).slice(-30)),
      [SNOOZED]: snoozed,
    });
  } catch (error) {
    // Offline or signed out: try again at the next alarm
    console.debug("[clozer] pulse", error);
  } finally {
    running = false;
  }
}

async function notice(id: string) {
  const stored = await browser.storage.session.get(NOTICES);
  return ((stored[NOTICES] as Notices | undefined) ?? {})[id];
}

export function listenToNotifications() {
  browser.notifications.onClicked.addListener(async (id) => {
    if (!id.startsWith(NOTICE_PREFIX)) return;
    const target = await notice(id);
    if (target) await browser.tabs.create({ url: target.url });
    await browser.notifications.clear(id);
  });

  browser.notifications.onButtonClicked.addListener(async (id, index) => {
    if (!id.startsWith(NOTICE_PREFIX)) return;
    const target = await notice(id);
    if (target && index === 0) await browser.tabs.create({ url: target.url });
    if (target && index === 1) {
      const stored = await browser.storage.session.get(SNOOZED);
      const snoozed = (stored[SNOOZED] as Record<string, number> | undefined) ?? {};
      await browser.storage.session.set({ [SNOOZED]: { ...snoozed, [target.linkId]: Date.now() + SNOOZE_MS } });
    }
    await browser.notifications.clear(id);
  });
}
