import { requireOutreach } from "@/lib/outreach/flag";
import { allSuppressions } from "@/lib/outreach/suppression";
import { suppressionsCsv } from "@/lib/outreach/suppression-csv";
import { consumeLimit, tooManyRequests } from "@/lib/rate-limit";

/** The workspace stop list as a spreadsheet-friendly CSV. */
export async function GET(request: Request) {
  const { user, organization } = await requireOutreach();
  if (!(await consumeLimit("suppressionExport", request.headers, user.id))) return tooManyRequests();

  return new Response(suppressionsCsv(await allSuppressions(organization.id)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clozer-liste-arret.csv"',
      "Cache-Control": "no-store",
    },
  });
}
