import { randomInt } from "node:crypto";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function randomSlug(length = 12) {
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += ALPHABET[randomInt(ALPHABET.length)];
  }
  return slug;
}
