import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import { getStyleTargetsForNodes } from "./style-targets-core";

function createStatefulViewNode(params: {
  id: string;
  baseColor: string;
  stateColor: string;
  width: number;
}): SnapshotNode {
  return {
    children: [],
    data: {
      interactions: [],
      linkedVariables: [],
      localVariables: [],
      name: params.id,
      states: [
        {
          id: "state-1",
          pos: "a0",
          value: {
            condition: {
              type: "or",
              value: [],
            },
            id: `state-value-${params.id}`,
            name: "Hovered",
            overrides: {
              actions: [],
              style: {
                backgroundColor: params.stateColor,
              },
            },
          },
        },
      ],
      style: {
        backgroundColor: params.baseColor,
        width: params.width,
      },
    },
    id: params.id,
    parentId: "root",
    pos: "a0",
    type: "view",
  } as unknown as SnapshotNode;
}

describe("getStyleTargetsForNodes", () => {
  test("uses each node's selected state for effective style and mixed keys", () => {
    const nodeA = createStatefulViewNode({
      baseColor: "rgba(255, 0, 0, 1)",
      id: "node-a",
      stateColor: "rgba(0, 255, 0, 1)",
      width: 100,
    });
    const nodeB = createStatefulViewNode({
      baseColor: "rgba(0, 0, 255, 1)",
      id: "node-b",
      stateColor: "rgba(255, 255, 0, 1)",
      width: 100,
    });

    const result = getStyleTargetsForNodes([nodeA, nodeB], {
      "node-a": "state-1",
      "node-b": "state-1",
    });

    expect(result.style?.backgroundColor).toBe("rgba(0, 255, 0, 1)");
    expect(result.mixedKeys.has("backgroundColor")).toBe(true);
    expect(result.mixedKeys.has("width")).toBe(false);
    expect(result.targets).toEqual([
      { nodeId: "node-a", nodeType: "view" },
      { nodeId: "node-b", nodeType: "view" },
    ]);
  });

  test("returns non-mixed keys when effective styles match", () => {
    const nodeA = createStatefulViewNode({
      baseColor: "rgba(255, 0, 0, 1)",
      id: "node-a",
      stateColor: "rgba(0, 255, 0, 1)",
      width: 100,
    });
    const nodeB = createStatefulViewNode({
      baseColor: "rgba(0, 0, 255, 1)",
      id: "node-b",
      stateColor: "rgba(0, 255, 0, 1)",
      width: 100,
    });

    const result = getStyleTargetsForNodes([nodeA, nodeB], {
      "node-a": "state-1",
      "node-b": "state-1",
    });

    expect(result.mixedKeys.has("backgroundColor")).toBe(false);
    expect(result.mixedKeys.has("width")).toBe(false);
  });
});
