import { describe, expect, test } from "vite-plus/test";

import type { Variable } from "./snapshot-types";
import type { SnapshotNode } from "./types";
import {
  collectVariables,
  collectVariableScopes,
  createChainVariableReader,
  findDeclaringNodeInChain,
  type VariableScopes,
} from "./variables";

function entry(entryId: string, variable: Variable): { id: string; pos: string; value: Variable } {
  return { id: entryId, pos: "a0", value: variable };
}

function makeViewNode(
  id: string,
  localVariables: Array<{ id: string; pos: string; value: Variable }>,
  children: SnapshotNode[] = [],
): SnapshotNode {
  return {
    type: "view",
    id,
    parentId: null,
    pos: "a0",
    data: {
      name: "View",
      localVariables,
      linkedVariables: [],
      interactions: [],
      states: [],
      style: {},
    },
    children,
  } as unknown as SnapshotNode;
}

function makeRootNode(children: SnapshotNode[]): SnapshotNode {
  return {
    type: "root",
    id: "root",
    parentId: null,
    pos: "a0",
    data: { name: "Root" },
    children,
  } as unknown as SnapshotNode;
}

describe("collectVariables", () => {
  test("collects variables scoped to each node", () => {
    const node = makeViewNode("view-1", [
      entry("entry-1", { id: "var-1", name: "isActive", value: { key: "boolean", value: true } }),
      entry("entry-2", { id: "var-2", name: "count", value: { key: "number", value: 42 } }),
    ]);

    const map = collectVariables(node);
    expect(map.size).toBe(1);

    const nodeVars = map.get("view-1");
    expect(nodeVars).toBeDefined();
    // 2 variables × 2 IDs each (internal + entry)
    expect(nodeVars!.store.size).toBe(4);
    expect(nodeVars!.store.get("var-1")).toEqual({ key: "boolean", value: true });
    expect(nodeVars!.store.get("entry-1")).toEqual({ key: "boolean", value: true });
    expect(nodeVars!.store.get("var-2")).toEqual({ key: "number", value: 42 });
    expect(nodeVars!.store.get("entry-2")).toEqual({ key: "number", value: 42 });
  });

  test("skips entries whose variable lacks an internal id or value", () => {
    const node = makeViewNode("view-1", [
      entry("entry-1", {
        name: "no-id",
        value: { key: "boolean", value: true },
      } as unknown as Variable),
      entry("entry-2", { id: "var-2", name: "no-value" } as unknown as Variable),
      entry("entry-3", { id: "var-3", name: "ok", value: { key: "number", value: 1 } }),
    ]);

    const map = collectVariables(node);
    const nodeVars = map.get("view-1");
    expect(nodeVars).toBeDefined();
    expect(nodeVars!.store.size).toBe(2);
    expect(nodeVars!.store.get("var-3")).toEqual({ key: "number", value: 1 });
    expect(nodeVars!.store.get("entry-3")).toEqual({ key: "number", value: 1 });
  });

  test("returns bidirectional aliases per node", () => {
    const node = makeViewNode("view-1", [
      entry("entry-1", { id: "var-1", name: "isActive", value: { key: "boolean", value: true } }),
    ]);

    const map = collectVariables(node);
    const nodeVars = map.get("view-1");
    expect(nodeVars).toBeDefined();
    expect(nodeVars!.aliases.get("entry-1")).toBe("var-1");
    expect(nodeVars!.aliases.get("var-1")).toBe("entry-1");
  });

  test("collects variables from nested nodes into separate stores", () => {
    const child = makeViewNode("view-2", [
      entry("entry-2", { id: "var-2", name: "label", value: { key: "string", value: "hello" } }),
    ]);
    const parent = makeViewNode(
      "view-1",
      [
        entry("entry-1", {
          id: "var-1",
          name: "isActive",
          value: { key: "boolean", value: false },
        }),
      ],
      [child],
    );

    const map = collectVariables(parent);
    expect(map.size).toBe(2);

    const parentVars = map.get("view-1");
    expect(parentVars!.store.size).toBe(2);
    expect(parentVars!.store.get("var-1")).toEqual({ key: "boolean", value: false });

    const childVars = map.get("view-2");
    expect(childVars!.store.size).toBe(2);
    expect(childVars!.store.get("var-2")).toEqual({ key: "string", value: "hello" });
  });

  test("collects from root with multiple children", () => {
    const root = makeRootNode([
      makeViewNode("view-1", [
        entry("entry-1", { id: "var-1", name: "a", value: { key: "boolean", value: true } }),
      ]),
      makeViewNode("view-2", [
        entry("entry-2", { id: "var-2", name: "b", value: { key: "number", value: 10 } }),
      ]),
    ]);

    const map = collectVariables(root);
    expect(map.size).toBe(2);
    expect(map.get("view-1")!.store.get("var-1")).toEqual({ key: "boolean", value: true });
    expect(map.get("view-2")!.store.get("var-2")).toEqual({ key: "number", value: 10 });
  });

  test("returns empty map for tree with no variables", () => {
    const root = makeRootNode([makeViewNode("view-1", [])]);
    const map = collectVariables(root);
    expect(map.size).toBe(0);
  });

  test("handles nodes whose data has no localVariables property", () => {
    const root: SnapshotNode = {
      type: "root",
      id: "root",
      parentId: null,
      pos: "a0",
      data: {},
      children: [],
    } as unknown as SnapshotNode;

    const map = collectVariables(root);
    expect(map.size).toBe(0);
  });

  test("two nodes with same variable IDs do not collide", () => {
    const root = makeRootNode([
      makeViewNode("view-1", [
        entry("entry-1", { id: "var-1", name: "isActive", value: { key: "boolean", value: true } }),
      ]),
      makeViewNode("view-2", [
        entry("entry-1", {
          id: "var-1",
          name: "isActive",
          value: { key: "boolean", value: false },
        }),
      ]),
    ]);

    const map = collectVariables(root);
    expect(map.size).toBe(2);

    // Each node keeps its own value
    expect(map.get("view-1")!.store.get("var-1")).toEqual({ key: "boolean", value: true });
    expect(map.get("view-2")!.store.get("var-1")).toEqual({ key: "boolean", value: false });
  });
});

describe("collectVariableScopes", () => {
  function makeChainTree(): SnapshotNode {
    // root → view-outer(var-outer, var-shadowed) → view-mid(no vars) → view-inner(var-inner, var-shadowed)
    const inner = makeViewNode("view-inner", [
      entry("entry-inner", {
        id: "var-inner",
        name: "inner",
        value: { key: "string", value: "inner-value" },
      }),
      entry("entry-shadowed-inner", {
        id: "var-shadowed",
        name: "shadowed",
        value: { key: "number", value: 2 },
      }),
    ]);
    const mid = makeViewNode("view-mid", [], [inner]);
    const outer = makeViewNode(
      "view-outer",
      [
        entry("entry-outer", {
          id: "var-outer",
          name: "outer",
          value: { key: "boolean", value: true },
        }),
        entry("entry-shadowed-outer", {
          id: "var-shadowed",
          name: "shadowed",
          value: { key: "number", value: 1 },
        }),
      ],
      [mid],
    );
    return makeRootNode([outer]);
  }

  function readerFor(scopes: VariableScopes, nodeId: string) {
    return createChainVariableReader(scopes.parents, (id) => scopes.stores.get(id)?.store, nodeId);
  }

  test("returns stores matching collectVariables and parent links for every node", () => {
    const root = makeChainTree();
    const scopes = collectVariableScopes(root);

    expect(scopes.stores.size).toBe(2);
    expect(scopes.stores.get("view-outer")!.store.get("var-outer")).toEqual({
      key: "boolean",
      value: true,
    });

    expect(scopes.parents.get("root")).toBe(null);
    expect(scopes.parents.get("view-outer")).toBe("root");
    expect(scopes.parents.get("view-mid")).toBe("view-outer");
    expect(scopes.parents.get("view-inner")).toBe("view-mid");
  });

  test("own store wins", () => {
    const scopes = collectVariableScopes(makeChainTree());
    expect(readerFor(scopes, "view-inner").get("var-inner")).toEqual({
      key: "string",
      value: "inner-value",
    });
  });

  test("falls back to the nearest ancestor store", () => {
    const scopes = collectVariableScopes(makeChainTree());
    expect(readerFor(scopes, "view-inner").get("var-outer")).toEqual({
      key: "boolean",
      value: true,
    });
    // A node without any store of its own resolves through ancestors too.
    expect(readerFor(scopes, "view-mid").get("var-outer")).toEqual({
      key: "boolean",
      value: true,
    });
  });

  test("shadowed id: nearest declaration wins for reads", () => {
    const scopes = collectVariableScopes(makeChainTree());
    expect(readerFor(scopes, "view-inner").get("var-shadowed")).toEqual({
      key: "number",
      value: 2,
    });
    // From the middle node the outer declaration is the nearest.
    expect(readerFor(scopes, "view-mid").get("var-shadowed")).toEqual({
      key: "number",
      value: 1,
    });
  });

  test("shadowed id: writes target the nearest declaring store", () => {
    const scopes = collectVariableScopes(makeChainTree());
    const getStore = (nodeId: string) => scopes.stores.get(nodeId)?.store;

    expect(findDeclaringNodeInChain(scopes.parents, getStore, "view-inner", "var-shadowed")).toBe(
      "view-inner",
    );
    expect(findDeclaringNodeInChain(scopes.parents, getStore, "view-mid", "var-shadowed")).toBe(
      "view-outer",
    );
    expect(findDeclaringNodeInChain(scopes.parents, getStore, "view-inner", "missing")).toBe(
      undefined,
    );
  });

  test("variables not declared anywhere in the chain resolve to undefined", () => {
    const scopes = collectVariableScopes(makeChainTree());
    expect(readerFor(scopes, "view-inner").get("missing")).toBe(undefined);
    // Sibling scopes are not visible: var-inner is not in view-outer's chain.
    expect(readerFor(scopes, "view-outer").get("var-inner")).toBe(undefined);
  });

  test("createChainVariableReader reads through the chain and sees live store updates", () => {
    const scopes = collectVariableScopes(makeChainTree());
    const liveStores = new Map(
      [...scopes.stores].map(([nodeId, { store }]) => [nodeId, new Map(store)]),
    );
    const reader = createChainVariableReader(
      scopes.parents,
      (nodeId) => liveStores.get(nodeId),
      "view-inner",
    );

    expect(reader.get("var-shadowed")).toEqual({ key: "number", value: 2 });
    expect(reader.get("var-outer")).toEqual({ key: "boolean", value: true });
    expect(reader.get("missing")).toBe(undefined);

    liveStores.get("view-outer")!.set("var-outer", { key: "boolean", value: false });
    expect(reader.get("var-outer")).toEqual({ key: "boolean", value: false });
  });
});
