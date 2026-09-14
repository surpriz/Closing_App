import { get, head } from "@vercel/blob";

// Always pass the token explicitly: when BLOB_STORE_ID is set the SDK switches
// to OIDC auth, which is disabled for local development.
export function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  return token;
}

export function documentUploadPrefix(organizationId: string) {
  return `orgs/${organizationId}/documents/`;
}

export function headPrivateBlob(pathname: string) {
  return head(pathname, { token: blobToken() });
}

export async function streamPrivateBlob(pathname: string) {
  const result = await get(pathname, { access: "private", token: blobToken() });
  if (!result || result.statusCode !== 200) return null;
  return result;
}

export async function readPrivateBlob(pathname: string) {
  const result = await streamPrivateBlob(pathname);
  if (!result) throw new Error(`Blob not found: ${pathname}`);
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}
