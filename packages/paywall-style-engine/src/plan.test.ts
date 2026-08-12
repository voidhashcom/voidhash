import { describe, expect, it } from "vitest";

import { planStyleEdit } from "./plan.ts";
import type { StyleTargetView } from "./model.ts";

function view(overrides: Partial<StyleTargetView> & { nodeId: string }): StyleTargetView {
  return {
    nodeType: "view",
    style: {},
    baseStyle: {},
    parent: { direction: "column", alignItems: "stretch" },
    ...overrides,
  };
}

describe("planStyleEdit", () => {
  it("repairs flex sizing PER NODE across mixed parent directions", () => {
    const plan = planStyleEdit(
      { kind: "setStyle", style: { width: 100 } },
      [
        view({ nodeId: "a", style: { alignSelf: "stretch" } }),
        view({
          nodeId: "b",
          style: { flex: 1 },
          parent: { direction: "row", alignItems: "stretch" },
        }),
      ],
    );
    expect(plan.nodes[0]?.patch).toEqual({ width: 100, alignSelf: "auto" });
    expect(plan.nodes[1]?.patch).toEqual({ width: 100, flex: undefined });
  });

  it("plans a cross-axis fill per node from each node's own context", () => {
    const plan = planStyleEdit({ kind: "setSizingMode", axis: "width", mode: "fill" }, [
      view({ nodeId: "a" }),
      view({ nodeId: "b", parent: { direction: "row", alignItems: "stretch" } }),
    ]);
    expect(plan.nodes[0]?.patch).toEqual({ width: "auto", alignSelf: "stretch" });
    expect(plan.nodes[1]?.patch).toEqual({ width: "auto", flex: 1 });
  });

  it("blocks capability-unavailable ops with a diagnostic instead of writing", () => {
    const plan = planStyleEdit({ kind: "setSizingMode", axis: "width", mode: "fill" }, [
      view({ nodeId: "a", parent: null }),
    ]);
    expect(plan.nodes[0]?.patch).toEqual({});
    expect(plan.nodes[0]?.diagnostics[0]?.code).toBe("capability-unavailable");
    expect(plan.empty).toBe(true);
  });

  it("uses computed sizes for fixed switches and falls back to 100", () => {
    const withComputed = planStyleEdit(
      { kind: "setSizingMode", axis: "width", mode: "fixed" },
      [view({ nodeId: "a" })],
      { computedSizes: new Map([["a", { width: 220 }]]) },
    );
    expect(withComputed.nodes[0]?.patch["width"]).toBe(220);

    const fallback = planStyleEdit({ kind: "setSizingMode", axis: "width", mode: "fixed" }, [
      view({ nodeId: "a", style: { alignSelf: "flex-start" } }),
    ]);
    expect(fallback.nodes[0]?.patch["width"]).toBe(100);
  });

  it("drops keys already effective, keeping override-clearing writes", () => {
    const noOp = planStyleEdit({ kind: "setStyle", style: { gap: 8 } }, [
      view({ nodeId: "a", style: { gap: 8 }, baseStyle: { gap: 8 } }),
    ]);
    expect(noOp.empty).toBe(true);

    const clearsOverride = planStyleEdit({ kind: "setStyle", style: { gap: 8 } }, [
      view({
        nodeId: "a",
        style: { gap: 8 },
        baseStyle: { gap: 8 },
        stateId: "s1",
        stateOverrides: { gap: 8 },
      }),
    ]);
    expect(clearsOverride.nodes[0]?.patch).toEqual({ gap: 8 });
    expect(clearsOverride.nodes[0]?.layer).toEqual({ kind: "state", stateId: "s1" });
  });

  it("escalates to whole-set discipline when structured values are involved", () => {
    const gradient = {
      kind: "linear",
      startX: 0,
      startY: 0,
      endX: 1,
      endY: 1,
      stops: [{ color: "rgba(1, 2, 3, 1)", position: 0 }],
    };
    const structured = planStyleEdit(
      { kind: "setStyle", style: { backgroundGradient: gradient } },
      [view({ nodeId: "a" })],
    );
    expect(structured.nodes[0]?.discipline).toBe("whole-set");

    const scalar = planStyleEdit({ kind: "setStyle", style: { gap: 4 } }, [view({ nodeId: "a" })]);
    expect(scalar.nodes[0]?.discipline).toBe("merge-update");
  });

  it("plans absolute positioning with seeded insets and full flow restore", () => {
    const absolute = planStyleEdit(
      { kind: "setPositioning", mode: "absolute", insets: { left: 12, top: 24 } },
      [view({ nodeId: "a" })],
    );
    expect(absolute.nodes[0]?.patch).toEqual({ position: "absolute", left: 12, top: 24 });

    const flow = planStyleEdit({ kind: "setPositioning", mode: "flow" }, [
      view({ nodeId: "a", style: { position: "absolute", left: 12, top: 24 } }),
    ]);
    expect(flow.nodes[0]?.patch).toEqual({
      position: "relative",
      left: "auto",
      top: "auto",
      right: "auto",
      bottom: "auto",
    });
  });
});
