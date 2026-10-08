import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: ({ mode }) => {
    const apiOrigin = new URL(process.env.WXT_API_ORIGIN ?? "http://localhost:3000").origin;
    // Fixed key outside production so the extension ID stays stable across machines,
    // which the app needs in EXTENSION_IDS. The Web Store assigns the production ID.
    const devKey = process.env.WXT_MANIFEST_KEY;
    return {
      name: mode === "production" ? "Clozer" : `Clozer (${mode})`,
      description: "Remplacez une pièce jointe PDF par un lien Clozer dans Gmail et Outlook, et sachez quand un prospect lit votre proposition.",
      // notifications + alarms + idle: "your prospect is reading right now", polled every 30 s
      permissions: ["storage", "notifications", "alarms", "idle"],
      host_permissions: [`${apiOrigin}/*`],
      externally_connectable: { matches: [`${apiOrigin}/extension/connect*`] },
      ...(mode !== "production" && devKey ? { key: devKey } : {}),
    };
  },
});
