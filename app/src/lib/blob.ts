import { del, get, head, put } from "@vercel/blob";

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

export function capsuleUploadPrefix(organizationId: string) {
  return `orgs/${organizationId}/capsules/`;
}

export function voiceCommentPrefix(organizationId: string, linkId: string) {
  return `orgs/${organizationId}/voice/${linkId}/`;
}

export function putPrivateBlob(pathname: string, body: Uint8Array, contentType: string) {
  return put(pathname, Buffer.from(body), {
    access: "private",
    contentType,
    addRandomSuffix: true,
    token: blobToken(),
  });
}

export function headPrivateBlob(pathname: string) {
  return head(pathname, { token: blobToken() });
}

export function deletePrivateBlob(pathname: string) {
  return del(pathname, { token: blobToken() });
}

export async function streamPrivateBlob(pathname: string) {
  const result = await get(pathname, { access: "private", token: blobToken() });
  if (!result || result.statusCode !== 200) return null;
  return result;
}

/** Forwards a Range header: a 206 from the store comes back with a `content-range` header. */
export async function streamPrivateBlobRange(pathname: string, range: string) {
  const result = await get(pathname, { access: "private", token: blobToken(), headers: { Range: range } });
  if (!result || result.statusCode !== 200) return null;
  return result;
}

export async function readPrivateBlob(pathname: string) {
  const result = await streamPrivateBlob(pathname);
  if (!result) throw new Error(`Blob not found: ${pathname}`);
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}
