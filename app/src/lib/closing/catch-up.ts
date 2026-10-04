import { inBackground } from "./background";
import { analyzePendingDeals } from "./brain/analyze-deal";
import { readPendingDocuments } from "./documents/read-pages";

/**
 * What the engine would do for this workspace, started when the seller opens
 * a page. The analysis then never waits on the cron, whose cadence is not
 * guaranteed (and which doesn't run at all on some environments). Runs after
 * the response; the next page load shows the result.
 */
export function catchUpInBackground(scope: { organizationId: string; linkId?: string; documentId?: string }) {
  inBackground("catch-up", async () => {
    const now = new Date();
    await readPendingDocuments(now, 1, { organizationId: scope.organizationId, documentId: scope.documentId });
    await analyzePendingDeals(now, { organizationId: scope.organizationId, linkId: scope.linkId, max: 3 });
  });
}
