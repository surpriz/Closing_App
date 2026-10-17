import { legalRoute } from "@/components/legal-route";
import { SupportEn } from "@/content/support.en";
import { SupportFr } from "@/content/support.fr";

const route = legalRoute({
  path: "/support",
  messages: "support",
  content: { en: SupportEn, fr: SupportFr },
});

export const generateMetadata = route.generateMetadata;
export default route.Page;
