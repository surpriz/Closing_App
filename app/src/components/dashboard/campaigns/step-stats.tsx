import { getTranslations } from "next-intl/server";

import { SectionTitle } from "@/components/dashboard/page-header";
import { OutcomeTable } from "@/components/dashboard/results/outcome-table";
import { getStepStats } from "@/lib/outreach/results";

/** What each step (and each AI follow-up) of the campaign led to. Hidden until something is sent. */
export async function StepStats({ campaignId }: { campaignId: string }) {
  const [t, tl, stats] = await Promise.all([
    getTranslations("campaigns.stats"),
    getTranslations("labels"),
    getStepStats(campaignId),
  ]);
  if (stats.length === 0) return null;

  const groups = stats.map((group) => {
    const trigger = tl.has(`followupTrigger.${group.key}` as never) ? tl(`followupTrigger.${group.key}` as never) : group.key;
    return {
      ...group,
      label: group.order === null ? t("aiLabel", { label: trigger }) : t("stepLabel", { order: group.order }),
    };
  });

  return (
    <section>
      <SectionTitle>{t("title")}</SectionTitle>
      <OutcomeTable label={t("step")} groups={groups} />
    </section>
  );
}
