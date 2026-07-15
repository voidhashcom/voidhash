import { describe, expect, test } from "vite-plus/test";

import { getExpandedLayerIdsForSelection } from "./layer-expansion";

const tree = {
  children: [
    {
      children: [
        {
          children: [{ id: "headline" }],
          id: "hero",
        },
        {
          children: [{ id: "plan-label" }],
          id: "plans",
        },
      ],
      id: "screen",
    },
  ],
  id: "root",
};

describe("layer expansion", () => {
  test("expands every ancestor of a selected leaf", () => {
    expect(getExpandedLayerIdsForSelection(tree, ["headline"])).toEqual(
      new Set(["hero", "screen", "root"]),
    );
  });

  test("expands ancestors when the selected node has children", () => {
    expect(getExpandedLayerIdsForSelection(tree, ["hero"])).toEqual(
      new Set(["screen", "root"]),
    );
  });

  test("expands paths for selections in separate branches", () => {
    expect(getExpandedLayerIdsForSelection(tree, ["headline", "plan-label"])).toEqual(
      new Set(["hero", "plans", "screen", "root"]),
    );
  });
});
