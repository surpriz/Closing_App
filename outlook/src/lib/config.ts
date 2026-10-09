export const APP_ORIGIN = new URL(import.meta.env.VITE_APP_ORIGIN ?? "https://localhost:3000").origin;

// Same limit as the app (MAX_UPLOAD_BYTES)
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Name of this client in the app's EXTENSION_DISABLED_HOSTS kill switch
export const KILL_SWITCH_HOST = "outlook-addin";
