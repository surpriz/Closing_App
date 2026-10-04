const MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function looksLikePdf(file: { name: string; type: string }) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function hasPdfMagic(bytes: Uint8Array) {
  return MAGIC.every((byte, index) => bytes[index] === byte);
}

// Same rule as the dashboard upload: ASCII, no spaces, at most 120 characters
export function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-120);
}
