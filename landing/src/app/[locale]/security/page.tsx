import { legalRoute } from "@/components/legal-route";
import { SecurityEn } from "@/content/security.en";
import { SecurityFr } from "@/content/security.fr";

const route = legalRoute({
  path: "/security",
  messages: "security",
  content: { en: SecurityEn, fr: SecurityFr },
  translated: true,
});

export const generateMetadata = route.generateMetadata;
export default route.Page;
