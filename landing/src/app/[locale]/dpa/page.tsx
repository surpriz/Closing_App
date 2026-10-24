import { legalRoute } from "@/components/legal-route";
import { DpaEn } from "@/content/dpa.en";
import { DpaFr } from "@/content/dpa.fr";

const route = legalRoute({
  path: "/dpa",
  messages: "dpa",
  content: { en: DpaEn, fr: DpaFr },
  translated: true,
});

export const generateMetadata = route.generateMetadata;
export default route.Page;
