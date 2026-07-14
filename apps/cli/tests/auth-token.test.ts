import { describe, expect, it } from "vitest";

import { buildMcpHeaders } from "../src/cli/commands/auth-token";

describe("buildMcpHeaders", () => {
  it("emits bearer authorization and an optional project selector", () => {
    expect(buildMcpHeaders("vh_cli_secret", "project-slug")).toEqual({
      Authorization: "Bearer vh_cli_secret",
      "X-Voidhash-Project": "project-slug",
    });
    expect(buildMcpHeaders("vh_cli_secret", undefined)).toEqual({
      Authorization: "Bearer vh_cli_secret",
    });
  });
});
