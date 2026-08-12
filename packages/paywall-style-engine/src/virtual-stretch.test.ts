import { describe, expect, it } from "vitest";

import { collapseContainerStretch, expandContainerStretch } from "./virtual-stretch.ts";

const child = (nodeId: string, style: Record<string, unknown> = {}) => ({ nodeId, style });

describe("collapseContainerStretch", () => {
  it("collapses all-explicit-stretch children to parent alignItems: stretch", () => {
    const plan = collapseContainerStretch({ alignItems: "flex-start" }, [
      child("a", { alignSelf: "stretch" }),
      child("b", { alignSelf: "stretch" }),
    ]);
    expect(plan?.parentPatch).toEqual({ alignItems: "stretch" });
    expect([...plan!.childPatches]).toEqual([
      ["a", { alignSelf: "auto" }],
      ["b", { alignSelf: "auto" }],
    ]);
  });

  it("clears redundant child markers when the parent already stretches", () => {
    const plan = collapseContainerStretch({ alignItems: "stretch" }, [
      child("a", { alignSelf: "stretch" }),
    ]);
    expect(plan?.parentPatch).toEqual({});
    expect(plan?.childPatches.get("a")).toEqual({ alignSelf: "auto" });
  });

  it("does not collapse when any child is not explicitly stretching, or with no children", () => {
    expect(
      collapseContainerStretch({ alignItems: "flex-start" }, [
        child("a", { alignSelf: "stretch" }),
        child("b", { alignSelf: "center" }),
      ]),
    ).toBeNull();
    expect(collapseContainerStretch({ alignItems: "flex-start" }, [])).toBeNull();
  });

  it("honors pending overrides so the collapse can be planned before the write lands", () => {
    const plan = collapseContainerStretch(
      { alignItems: "flex-start" },
      [child("a", { alignSelf: "stretch" }), child("b", { alignSelf: "flex-start" })],
      new Map([["b", { alignSelf: "stretch" }]]),
    );
    expect(plan?.parentPatch).toEqual({ alignItems: "stretch" });
    expect(plan?.childPatches.get("b")).toEqual({ alignSelf: "auto" });
  });
});

describe("expandContainerStretch", () => {
  it("marks container-driven filling children explicitly when leaving stretch", () => {
    const plan = expandContainerStretch(
      { alignItems: "stretch", flexDirection: "column" },
      [
        child("driven", { alignSelf: "auto", width: "auto" }),
        child("fixed", { alignSelf: "auto", width: 100 }),
        child("opted-out", { alignSelf: "flex-start", width: "auto" }),
      ],
      "center",
    );
    expect(plan.parentPatch).toEqual({ alignItems: "center" });
    expect([...plan.childPatches]).toEqual([["driven", { alignSelf: "stretch" }]]);
  });

  it("uses the row cross axis (height) for row containers", () => {
    const plan = expandContainerStretch(
      { alignItems: "stretch", flexDirection: "row" },
      [child("a", { alignSelf: "auto", height: "auto", width: 50 })],
      "flex-end",
    );
    expect(plan.childPatches.get("a")).toEqual({ alignSelf: "stretch" });
  });

  it("is a plain alignment write when the parent was not stretching", () => {
    const plan = expandContainerStretch(
      { alignItems: "center", flexDirection: "column" },
      [child("a", { alignSelf: "auto", width: "auto" })],
      "flex-start",
    );
    expect(plan.parentPatch).toEqual({ alignItems: "flex-start" });
    expect(plan.childPatches.size).toBe(0);
  });
});
