import { z } from "zod";

import { getSellerPrefs, upsertSellerPrefs } from "@/lib/closing/notify/preferences";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

const schema = z.object({ extensionCallMoments: z.boolean() });

// The popup's "Notifications" switch: same setting as in Réglages › Être prévenu
export const GET = withExtensionAuth(async (_request, { user, organization }) => {
  const prefs = await getSellerPrefs(user.id, organization.id);
  return Response.json({ extensionCallMoments: prefs.extensionCallMoments });
});

export const PATCH = withExtensionAuth(async (request, { user, organization }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extError(400, "invalid");
  await upsertSellerPrefs(user.id, organization.id, parsed.data);
  return Response.json(parsed.data);
});
