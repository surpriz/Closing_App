export const API_ORIGIN = new URL(import.meta.env.WXT_API_ORIGIN ?? "http://localhost:3000").origin;

// Same limit as the app (MAX_UPLOAD_BYTES)
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
