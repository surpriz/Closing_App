// Extension messages are JSON: PDF bytes travel to the background as base64 chunks
export const CHUNK_BYTES = 2 * 1024 * 1024;

export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function* splitChunks(bytes: Uint8Array, size = CHUNK_BYTES) {
  for (let i = 0; i < bytes.length; i += size) yield toBase64(bytes.subarray(i, i + size));
}
