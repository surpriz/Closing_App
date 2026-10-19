import { describe, expect, it } from "vitest";

import { extensionIdsFrom, STORE_EXTENSION_ID } from "./extension-config";

describe("extension ids", () => {
  it("keeps the store build when EXTENSION_IDS is empty or missing", () => {
    expect(extensionIdsFrom(undefined)).toEqual([STORE_EXTENSION_ID]);
    expect(extensionIdsFrom("")).toEqual([STORE_EXTENSION_ID]);
  });

  it("adds the dev builds without listing the store one twice", () => {
    expect(extensionIdsFrom(` oidkcbbpbinommpbbpabnlhlnffekbjb , ${STORE_EXTENSION_ID}`)).toEqual([
      STORE_EXTENSION_ID,
      "oidkcbbpbinommpbbpabnlhlnffekbjb",
    ]);
  });
});
