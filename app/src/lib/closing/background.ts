import { after } from "next/server";

// Runs work after the response is sent and never lets it crash the request
export function inBackground(label: string, task: () => Promise<unknown>) {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[closing:${label}]`, error);
    }
  });
}
