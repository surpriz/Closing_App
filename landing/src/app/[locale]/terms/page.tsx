import { legalRoute } from "@/components/legal-route";
import { TermsEn } from "@/content/terms.en";
import { TermsFr } from "@/content/terms.fr";

const route = legalRoute({
  path: "/terms",
  messages: "terms",
  content: { en: TermsEn, fr: TermsFr },
  translated: true,
});

export const generateMetadata = route.generateMetadata;
export default route.Page;
