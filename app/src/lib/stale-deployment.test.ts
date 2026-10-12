import { describe, expect, it } from "vitest";

import { isStaleDeployment } from "./stale-deployment";

describe("isStaleDeployment", () => {
  it("spots a server action the new deployment no longer has", () => {
    const error = new Error(
      'Server Action "4062b13632097dc41ef97c1167cc5ed21289c6471b" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action',
    );
    expect(isStaleDeployment(error)).toBe(true);
  });

  it("leaves every other failure alone", () => {
    expect(isStaleDeployment(new Error("L'envoi a échoué."))).toBe(false);
    expect(isStaleDeployment("Server Action failed")).toBe(false);
    expect(isStaleDeployment(null)).toBe(false);
  });
});
