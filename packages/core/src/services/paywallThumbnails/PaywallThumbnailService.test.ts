import { describe, expect, it } from "vite-plus/test";

import { collectDeployedComponentContentHashes } from "./PaywallThumbnailService.ts";

describe("collectDeployedComponentContentHashes", () => {
  it("collects distinct non-empty contentHashes of deployed component nodes depth-first", () => {
    const snapshot = {
      type: "root",
      children: [
        {
          type: "screen",
          children: [
            { type: "component", data: { contentHash: "aaa" }, children: [] },
            {
              type: "view",
              children: [{ type: "component", data: { contentHash: "bbb" }, children: [] }],
            },
            // duplicate — deduped
            { type: "component", data: { contentHash: "aaa" }, children: [] },
          ],
        },
      ],
    };
    expect([...collectDeployedComponentContentHashes(snapshot)].sort()).toEqual(["aaa", "bbb"]);
  });

  it("skips local components (sentinel empty contentHash) and non-component nodes", () => {
    const snapshot = {
      type: "root",
      children: [
        // local code component — no served preview tree in v1
        { type: "component", data: { contentHash: "", componentSource: "local" }, children: [] },
        { type: "text", data: { text: "hi" }, children: [] },
        { type: "component", data: {}, children: [] },
      ],
    };
    expect(collectDeployedComponentContentHashes(snapshot).size).toBe(0);
  });

  it("tolerates a malformed / undefined snapshot", () => {
    expect(collectDeployedComponentContentHashes(undefined).size).toBe(0);
    expect(collectDeployedComponentContentHashes({ type: "root" }).size).toBe(0);
    expect(collectDeployedComponentContentHashes(null).size).toBe(0);
  });
});
