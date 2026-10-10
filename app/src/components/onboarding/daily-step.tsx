import { BellRing, Paperclip, PenLine, Phone } from "lucide-react";
import Link from "next/link";

import type { MailTool } from "@/lib/onboarding";

import { IconRow, StepHeading } from "./parts";

const SEND: Record<MailTool, string> = {
  chrome:
    "Joignez votre PDF comme d'habitude. L'extension le remplace par un lien au nom du destinataire, et le deal démarre quand vous envoyez.",
  outlook_addin:
    "Joignez votre PDF comme d'habitude. Le complément le remplace par un lien au nom du destinataire, et le deal démarre quand vous envoyez.",
  manual:
    "Ouvrez votre document dans Clozer, créez un lien pour ce prospect et collez-le dans votre email à la place du PDF.",
};

export function DailyStep({ tool }: { tool: MailTool }) {
  return (
    <div className="space-y-10">
      <StepHeading
        title="Au quotidien, c'est tout."
        lead="Vous continuez à vendre comme avant. Clozer s'occupe du suivi et vous dit quoi faire."
      />
      <ol className="space-y-6">
        <IconRow icon={Paperclip} title="Vous envoyez votre proposition">
          {SEND[tool]}
        </IconRow>
        <IconRow icon={BellRing} title="Vous êtes prévenu quand votre prospect lit">
          {tool === "manual"
            ? "Par email, et en direct sur votre tableau de bord « Aujourd'hui »."
            : "Une alerte dans votre messagerie et sur votre ordinateur : c'est le bon moment pour appeler."}
        </IconRow>
        <IconRow icon={PenLine} title="Vous validez les relances">
          Quand il faut relancer, Clozer écrit le message et vous prévient. Vous le relisez dans « Relances à valider »,
          vous le retouchez si besoin, et il part.
        </IconRow>
        <IconRow icon={Phone} title="Vous notez vos échanges">
          Un appel, une réponse reçue : notez-le en un clic sur la fiche du prospect. Clozer en tient compte pour la
          suite.
        </IconRow>
      </ol>
      <p className="text-small text-muted-foreground">
        Envie du détail ?{" "}
        <Link href="/comment-ca-marche" className="underline underline-offset-4">
          Comment Clozer pense
        </Link>
        , ce qu&apos;il regarde et les règles qu&apos;il respecte.
      </p>
    </div>
  );
}
