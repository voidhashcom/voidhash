import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import { createStyleOverrideResetContext } from "./style-override-reset";

function createStatefulViewNode(params: {
  id: string;
  baseColor: string;
  stateColor: string;
  baseWidth: number;
  stateId?: string;
}): SnapshotNode {
  const stateId = params.stateId ?? "state-1";
  return {
    children: [],
    data: {
      interactions: [],
      linkedVariables: [],
      localVariables: [],
      name: params.id,
      states: [
        {
          id: stateId,
          pos: "a0",
          value: {
            condition: { type: "or", value: [] },
            id: `state-value-${params.id}`,
            name: "Hovered",
            overrides: {
              actions: [],
              style: {
                backgroundColor: params.stateColor,
                width: params.baseWidth + 10,
              },
            },
          },
        },
      ],
      style: {
        backgroundColor: params.baseColor,
        width: params.baseWidth,
        height: 40,
      },
    },
    id: params.id,
    parentId: "root",
    pos: "a0",
    type: "view",
  } as unknown as SnapshotNode;
}

function createStatefulShapeNode(params: { id: string; stateId?: string }): SnapshotNode {
  const stateId = params.stateId ?? "state-1";
  return {
    children: [],
    data: {
      linkedVariables: [],
      localVariables: [],
      name: params.id,
      states: [
        {
          id: stateId,
          pos: "a0",
          value: {
            condition: { type: "or", value: [] },
            id: `state-value-${params.id}`,
            name: "Hovered",
            overrides: {
              style: {
                width: 250,
              },
            },
          },
        },
      ],
      style: {
        width: 100,
        height: 100,
      },
    },
    id: params.id,
    parentId: "root",
    pos: "a0",
    type: "shape",
  } as unknown as SnapshotNode;
}

describe("createStyleOverrideResetContext", () => {
  test("is active for single node with selected non-default state", () => {
    const node = createStatefulViewNode({
      id: "node-1",
      baseColor: "rgba(255, 0, 0, 1)",
      stateColor: "rgba(0, 255, 0, 1)",
      baseWidth: 100,
    });

    const result = createStyleOverrideResetContext([node], {
      "node-1": "state-1",
    });

    expect(result.isOverrideModeActive).toBe(true);
    expect(result.hasOverride(["backgroundColor"])).toBe(true);
    expect(result.hasOverride(["height"])).toBe(false);
  });

  test("is inactive for default state selection", () => {
    const node = createStatefulViewNode({
      id: "node-1",
      baseColor: "rgba(255, 0, 0, 1)",
      stateColor: "rgba(0, 255, 0, 1)",
      baseWidth: 100,
    });

    const result = createStyleOverrideResetContext([node], {
      "node-1": null,
    });

    expect(result.isOverrideModeActive).toBe(false);
    expect(result.hasOverride(["backgroundColor"])).toBe(false);
  });

  test("is inactive for multi-node selection", () => {
    const nodeA = createStatefulViewNode({
      id: "node-a",
      baseColor: "rgba(255, 0, 0, 1)",
      stateColor: "rgba(0, 255, 0, 1)",
      baseWidth: 100,
    });
    const nodeB = createStatefulViewNode({
      id: "node-b",
      baseColor: "rgba(255, 0, 0, 1)",
      stateColor: "rgba(0, 255, 0, 1)",
      baseWidth: 120,
    });

    const result = createStyleOverrideResetContext([nodeA, nodeB], {
      "node-a": "state-1",
      "node-b": "state-1",
    });

    expect(result.isOverrideModeActive).toBe(false);
  });

  test("is inactive for non-runtime state-capable nodes (shape/path)", () => {
    const node = createStatefulShapeNode({ id: "shape-1" });
    const result = createStyleOverrideResetContext([node], {
      "shape-1": "state-1",
    });

    expect(result.isOverrideModeActive).toBe(false);
    expect(result.hasOverride(["width"])).toBe(false);
  });

  test("builds reset patches from base style for single and compound keys", () => {
    const node = createStatefulViewNode({
      id: "node-1",
      baseColor: "rgba(10, 10, 10, 1)",
      stateColor: "rgba(0, 255, 0, 1)",
      baseWidth: 320,
    });

    const result = createStyleOverrideResetContext([node], {
      "node-1": "state-1",
    });

    expect(result.buildResetPatch(["backgroundColor"])).toEqual({
      backgroundColor: "rgba(10, 10, 10, 1)",
    });

    expect(result.buildResetPatch(["backgroundColor", "width"])).toEqual({
      backgroundColor: "rgba(10, 10, 10, 1)",
      width: 320,
    });
  });

  test("includes undefined base values in reset patches", () => {
    const node = createStatefulViewNode({
      id: "node-1",
      baseColor: "rgba(10, 10, 10, 1)",
      stateColor: "rgba(0, 255, 0, 1)",
      baseWidth: 320,
    });

    const result = createStyleOverrideResetContext([node], {
      "node-1": "state-1",
    });

    expect(result.buildResetPatch(["lineHeight"])).toEqual({
      lineHeight: undefined,
    });
  });
});
