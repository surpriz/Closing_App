import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Prefixes every page with a locale: "/" goes to /en or /fr after the NEXT_LOCALE cookie, then Accept-Language.
export default createMiddleware(routing);

export const config = {
  // Skip Next internals and files (sitemap.xml, robots.txt, icon.svg…).
  matcher: "/((?!_next|_vercel|.*\\..*).*)",
};
