import { CONTACT_EMAIL } from "@/components/links";
import { SUBPROCESSORS } from "@/components/subprocessors";

// Translation of subprocessors.fr.tsx, which prevails.
export function SubprocessorsEn() {
  return (
    <>
      <p>
        The providers below process personal data on behalf of Clozer. Each one is bound by a data processing
        agreement. We notify customers by email at least 30 days before adding one; they can object by writing to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <div className="mt-8 space-y-6">
        {SUBPROCESSORS.map((sub) => (
          <div key={sub.name} className="border-t border-rule pt-5">
            <p className="!mt-0 font-semibold text-ink">{sub.name}</p>
            <p className="!mt-1">{sub.purpose.en}</p>
            <p className="!mt-1 text-sm">
              {sub.location.en} · {sub.safeguard.en}
            </p>
          </div>
        ))}
      </div>

      <p>
        The tools the seller connects themselves (Slack, webhook, Calendly, Cal.com) are not our subprocessors: the
        seller chooses them and is responsible for them as controller.
      </p>
    </>
  );
}
