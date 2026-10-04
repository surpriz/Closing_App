/** The contact a deal is named after: the first one added to the link. */
export const firstProspect = {
  orderBy: { createdAt: "asc" },
  take: 1,
  select: { name: true, email: true, company: true },
} as const;

/** What `prospectLabel` needs, ready to spread into a Prisma link select. */
export const linkLabelSelect = { id: true, name: true, slug: true, prospects: firstProspect } as const;

/** How a deal is named across the dashboard: the company first. */
export function prospectLabel(link: {
  name: string | null;
  slug: string;
  prospects: { company: string | null; name: string | null; email: string | null }[];
}) {
  const prospect = link.prospects[0];
  return prospect?.company ?? link.name ?? prospect?.name ?? prospect?.email ?? link.slug;
}
