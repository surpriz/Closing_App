/** How a reader is named to the seller and in the forward emails: the name they gave, else their address. Pure. */
export function readerName(prospect: { name: string | null; email: string }) {
  return prospect.name?.trim() || prospect.email;
}
