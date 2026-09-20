import type { Link, WorkspaceSettings } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import type { ResolvedFollowupSettings } from "./types";

export function getWorkspaceSettings(organizationId: string) {
  return prisma.workspaceSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}

type LinkOverrides = Pick<
  Link,
  | "followupsEnabled"
  | "channels"
  | "hotPricingThresholdSec"
  | "inactivityDays"
  | "businessHourStart"
  | "businessHourEnd"
>;

// Link values win over workspace defaults when set
export function resolveFollowupSettings(
  link: LinkOverrides,
  settings: WorkspaceSettings,
): ResolvedFollowupSettings {
  return {
    enabled: link.followupsEnabled,
    channels: link.channels.length > 0 ? link.channels : settings.defaultChannels,
    hotPricingThresholdSec: link.hotPricingThresholdSec ?? settings.hotPricingThresholdSec,
    inactivityDays: link.inactivityDays.length > 0 ? link.inactivityDays : settings.inactivityDays,
    businessHourStart: link.businessHourStart ?? settings.businessHourStart,
    businessHourEnd: link.businessHourEnd ?? settings.businessHourEnd,
    businessDays: settings.businessDays,
    multiViewerThreshold: settings.multiViewerThreshold,
    reopenAfterInactivityDays: settings.reopenAfterInactivityDays,
    alertChannels: settings.alertChannels,
  };
}

export function defaultTimezone() {
  return process.env.DEFAULT_TIMEZONE || "Europe/Paris";
}
