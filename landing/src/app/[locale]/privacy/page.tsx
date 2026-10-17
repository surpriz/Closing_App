import { legalRoute } from "@/components/legal-route";
import { PrivacyEn } from "@/content/privacy.en";
import { PrivacyFr } from "@/content/privacy.fr";

const route = legalRoute({
  path: "/privacy",
  messages: "privacy",
  content: { en: PrivacyEn, fr: PrivacyFr },
  translated: true,
});

export const generateMetadata = route.generateMetadata;
export default route.Page;
