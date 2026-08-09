import { describe, expect, test } from "vite-plus/test";

import {
  collectAncestorVariables,
  toLabeledVariables,
  type AncestorVariablesSnapshotNode,
} from "./ancestor-variables";

function variableEntry(entryId: string, name: string, internalId?: string) {
  return {
    id: entryId,
    value: {
      id: internalId ?? entryId,
      name,
      value: { key: "boolean", value: true },
    },
  };
}

function makeTree(): AncestorVariablesSnapshotNode {
  return {
    children: [
      {
        children: [
          {
            children: [],
            data: {
              localVariables: [variableEntry("v-flex", "flexVar")],
              name: "Card",
            },
            id: "flex-1",
            type: "view",
          },
          {
            children: [],
            data: {
              localVariables: [variableEntry("v-sibling", "siblingVar")],
              name: "Sibling",
            },
            id: "flex-2",
            type: "view",
          },
        ],
        data: {
          localVariables: [variableEntry("v-screen", "screenVar", "var-internal-1")],
          name: "Screen",
        },
        id: "screen-1",
        type: "screen",
      },
    ],
    id: "root",
    type: "root",
  };
}

describe("collectAncestorVariables", () => {
  test("returns the lexical chain including self, own node first", () => {
    const variables = collectAncestorVariables(makeTree(), "flex-1");
    expect(variables.map((v) => v.id)).toEqual(["v-flex", "v-screen"]);
    expect(variables.map((v) => v.ownerNodeId)).toEqual(["flex-1", "screen-1"]);
    expect(variables.map((v) => v.ownerName)).toEqual(["Card", "Screen"]);
  });

  test("excludes sibling-owned variables", () => {
    const variables = collectAncestorVariables(makeTree(), "flex-1");
    expect(variables.some((v) => v.id === "v-sibling")).toBe(false);
  });

  test("carries the internal id as aliasId when it differs from the entry id", () => {
    const variables = collectAncestorVariables(makeTree(), "screen-1");
    expect(variables).toHaveLength(1);
    expect(variables[0]).toMatchObject({ aliasId: "var-internal-1", id: "v-screen" });
  });

  test("omits aliasId when the internal id equals the entry id", () => {
    const variables = collectAncestorVariables(makeTree(), "flex-1");
    expect(variables[0]?.aliasId).toBeUndefined();
  });

  test("falls back to the node type when the owner has no name", () => {
    const tree: AncestorVariablesSnapshotNode = {
      children: [],
      data: { localVariables: [variableEntry("v-1", "x")] },
      id: "screen-1",
      type: "screen",
    };
    const variables = collectAncestorVariables(tree, "screen-1");
    expect(variables[0]?.ownerName).toBe("screen");
  });

  test("returns an empty list for unknown nodes and null snapshots", () => {
    expect(collectAncestorVariables(makeTree(), "missing")).toEqual([]);
    expect(collectAncestorVariables(null, "flex-1")).toEqual([]);
  });

  test("skips malformed variable entries", () => {
    const tree: AncestorVariablesSnapshotNode = {
      children: [],
      data: {
        localVariables: [
          null,
          { id: "v-bad" },
          { id: "v-bad-2", value: { name: "x", value: { key: "weird", value: 1 } } },
          variableEntry("v-good", "good"),
        ],
      },
      id: "screen-1",
      type: "screen",
    };
    const variables = collectAncestorVariables(tree, "screen-1");
    expect(variables.map((v) => v.id)).toEqual(["v-good"]);
  });
});

describe("toLabeledVariables", () => {
  test("labels only variables owned by other nodes", () => {
    const labeled = toLabeledVariables(collectAncestorVariables(makeTree(), "flex-1"), "flex-1");
    expect(labeled.find((v) => v.id === "v-flex")?.ownerLabel).toBeUndefined();
    expect(labeled.find((v) => v.id === "v-screen")?.ownerLabel).toBe("Screen");
  });
});
