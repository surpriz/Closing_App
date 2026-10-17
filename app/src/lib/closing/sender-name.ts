/**
 * The name a prospect sees for the seller's side: the name the workspace set,
 * else the seller's own name, else the workspace, else the seller's address
 * before the @. Pure. A prospect should always know who is asking.
 */
export function viewerSenderName(input: {
  senderName: string | null | undefined;
  createdBy: { name: string | null; email: string } | null | undefined;
  organizationName: string | null | undefined;
}) {
  return (
    input.senderName?.trim() ||
    input.createdBy?.name?.trim() ||
    input.organizationName?.trim() ||
    input.createdBy?.email.split("@")[0] ||
    null
  );
}
