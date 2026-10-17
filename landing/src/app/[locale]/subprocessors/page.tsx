import { legalRoute } from "@/components/legal-route";
import { SubprocessorsEn } from "@/content/subprocessors.en";
import { SubprocessorsFr } from "@/content/subprocessors.fr";

const route = legalRoute({
  path: "/subprocessors",
  messages: "subprocessors",
  content: { en: SubprocessorsEn, fr: SubprocessorsFr },
  translated: true,
});

export const generateMetadata = route.generateMetadata;
export default route.Page;
