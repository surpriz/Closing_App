import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Development only: the Outlook add-in's event runtime has no console we can reach
// easily, so its dev build posts each step here. 404 everywhere else.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const body = (await request.text()).slice(0, 4000);
  await appendFile(join(tmpdir(), "clozer-outlook.log"), `${new Date().toISOString()} ${body}\n`);
  return new Response(null, { status: 204 });
}
