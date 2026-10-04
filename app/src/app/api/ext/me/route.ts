import { getPublicAppUrl } from "@/lib/app-origin";
import { extensionRemoteConfig } from "@/lib/extension-config";
import { withExtensionAuth } from "@/lib/extension-auth";

export const GET = withExtensionAuth(async (_request, { user, organization }) =>
  Response.json({
    user: { name: user.name, email: user.email },
    organization,
    appOrigin: getPublicAppUrl(),
    ...extensionRemoteConfig(),
  }),
);
