export type PresetId = "gmail-app-password" | "ovh" | "gandi" | "ionos" | "infomaniak" | "o2switch";

export type ImapPreset = {
  id: PresetId;
  label: string;
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean };
  spfInclude: string | null;
  dkimSelectors: string[];
  hint: "app_password" | "mailbox_password";
};

// The SPF includes for OVH, Gandi, IONOS and Infomaniak are NOT verified against the providers' docs yet.
// A wrong include only downgrades the SPF status shown to the user; it never blocks sending.
export const PRESETS: Record<PresetId, ImapPreset> = {
  "gmail-app-password": {
    id: "gmail-app-password",
    label: "Gmail (app password)",
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
    spfInclude: "_spf.google.com",
    dkimSelectors: ["google"],
    hint: "app_password",
  },
  ovh: {
    id: "ovh",
    label: "OVH",
    imap: { host: "ssl0.ovh.net", port: 993, secure: true },
    smtp: { host: "ssl0.ovh.net", port: 465, secure: true },
    spfInclude: "mx.ovh.com",
    dkimSelectors: ["default", "mail", "dkim", "k1", "s1", "s2"],
    hint: "mailbox_password",
  },
  gandi: {
    id: "gandi",
    label: "Gandi",
    imap: { host: "mail.gandi.net", port: 993, secure: true },
    smtp: { host: "mail.gandi.net", port: 465, secure: true },
    spfInclude: "_mailcust.gandi.net",
    dkimSelectors: ["default", "mail", "dkim"],
    hint: "mailbox_password",
  },
  ionos: {
    id: "ionos",
    label: "IONOS",
    imap: { host: "imap.ionos.com", port: 993, secure: true },
    smtp: { host: "smtp.ionos.com", port: 465, secure: true },
    spfInclude: "_spf-eu.ionos.com",
    dkimSelectors: ["default", "mail", "dkim"],
    hint: "mailbox_password",
  },
  infomaniak: {
    id: "infomaniak",
    label: "Infomaniak",
    imap: { host: "mail.infomaniak.com", port: 993, secure: true },
    smtp: { host: "mail.infomaniak.com", port: 465, secure: true },
    spfInclude: "spf.infomaniak.ch",
    dkimSelectors: ["default", "mail", "dkim"],
    hint: "mailbox_password",
  },
  // o2switch hosts are per-account: the real ones are guessed from the domain (see guessedPreset).
  o2switch: {
    id: "o2switch",
    label: "o2switch",
    imap: { host: "", port: 993, secure: true },
    smtp: { host: "", port: 465, secure: true },
    spfInclude: null,
    dkimSelectors: ["default", "mail", "dkim"],
    hint: "mailbox_password",
  },
};

export function presetFor(id: PresetId | null | undefined): ImapPreset | null {
  return id ? (PRESETS[id] ?? null) : null;
}

/** Best guess for hosts we have no preset for: mail.<domain> on the usual SSL ports. */
export function guessedPreset(domain: string): Pick<ImapPreset, "imap" | "smtp"> {
  const host = `mail.${domain.toLowerCase()}`;
  return { imap: { host, port: 993, secure: true }, smtp: { host, port: 465, secure: true } };
}
