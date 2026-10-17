import { legalRoute } from "@/components/legal-route";
import { LegalNoticeEn } from "@/content/legal-notice.en";
import { LegalNoticeFr } from "@/content/legal-notice.fr";

const route = legalRoute({
  path: "/legal",
  messages: "notice",
  content: { en: LegalNoticeEn, fr: LegalNoticeFr },
  translated: true,
});

export const generateMetadata = route.generateMetadata;
export default route.Page;
