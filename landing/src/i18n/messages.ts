import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

export type Messages = typeof en;

// Both ways, so a key missing from either file fails tsc (scripts/check-messages.mjs says which one).
const frHasEveryKey: Messages = fr;
const enHasEveryKey: typeof fr = en;

export const MESSAGES = { en: enHasEveryKey, fr: frHasEveryKey };
