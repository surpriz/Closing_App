import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: ({ mode }) => {
    const apiOrigin = new URL(process.env.WXT_API_ORIGIN ?? "http://localhost:3000").origin;
    // Fixed key outside production so the extension ID stays stable across machines,
    // which the app needs in EXTENSION_IDS. The Web Store assigns the production ID.
    const devKey = process.env.WXT_MANIFEST_KEY;
    return {
      // Name and description per Chrome UI language: public/_locales/{en,fr}/messages.json.
      // Dev and staging builds keep a plain name so they stand out next to the Store one.
      default_locale: "en",
      name: mode === "production" ? "__MSG_extName__" : `Clozer (${mode})`,
      description: "__MSG_extDescription__",
      homepage_url: "https://www.clozer.club/support",
      // notifications + alarms + idle: "your prospect is reading right now", polled every 30 s
      permissions: ["storage", "notifications", "alarms", "idle"],
      host_permissions: [`${apiOrigin}/*`],
      // Every app page: the dashboard asks whether the extension is here and signed in
      externally_connectable: { matches: [`${apiOrigin}/*`] },
      ...(mode !== "production" && devKey ? { key: devKey } : {}),
    };
  },
});
