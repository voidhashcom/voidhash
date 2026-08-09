import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { describe, expect, test } from "vite-plus/test";

import type {
  ComponentCatalogByContentHash,
  ComponentCatalogVersion,
} from "../designer-store-state";
import {
  canComponentNodeAcceptChildren,
  findComponentInsertionParent,
  findInsertionParent,
  nodePassesSlotGate,
} from "./component-children";

function makeVersion(manifest: Partial<ComponentManifest>): ComponentCatalogVersion {
  return {
    artifactBaseUrl: "https://assets.example/c/hash",
    contentHash: "hash-1",
    createdAt: new Date(0),
    hasPanel: false,
    manifest: {
      manifestVersion: 2,
      props: {},
      ...manifest,
    },
    previewStates: ["default"],
    slug: "card",
    version: 1,
  };
}

const slotlessCatalog: ComponentCatalogByContentHash = {
  "hash-1": makeVersion({ slot: false }),
};

describe("canComponentNodeAcceptChildren", () => {
  test("allows when the hash is unknown or missing (best effort)", () => {
    expect(canComponentNodeAcceptChildren(undefined, slotlessCatalog)).toBe(true);
    expect(canComponentNodeAcceptChildren("unknown-hash", slotlessCatalog)).toBe(true);
  });

  test("rejects when the manifest declares slot: false", () => {
    expect(canComponentNodeAcceptChildren("hash-1", slotlessCatalog)).toBe(false);
  });

  test("allows when slot is true or undeclared", () => {
    expect(
      canComponentNodeAcceptChildren("hash-1", { "hash-1": makeVersion({ slot: true }) }),
    ).toBe(true);
    expect(canComponentNodeAcceptChildren("hash-1", { "hash-1": makeVersion({}) })).toBe(true);
  });
});

describe("nodePassesSlotGate", () => {
  test("non-component nodes always pass", () => {
    expect(nodePassesSlotGate({ type: "view" }, slotlessCatalog)).toBe(true);
    expect(nodePassesSlotGate(null, slotlessCatalog)).toBe(true);
  });

  test("component nodes defer to the manifest gate", () => {
    expect(
      nodePassesSlotGate({ data: { contentHash: "hash-1" }, type: "component" }, slotlessCatalog),
    ).toBe(false);
    expect(
      nodePassesSlotGate({ data: { contentHash: "other" }, type: "component" }, slotlessCatalog),
    ).toBe(true);
  });
});

describe("findComponentInsertionParent", () => {
  const snapshot = {
    children: [
      {
        children: [
          {
            children: [
              {
                children: [],
                data: { contentHash: "hash-1" },
                id: "component-1",
                type: "component",
              },
              { children: [], id: "text-1", type: "text" },
            ],
            id: "flex-1",
            type: "view",
          },
        ],
        id: "screen-1",
        type: "screen",
      },
      { children: [], id: "screen-2", type: "screen" },
    ],
    id: "root",
    type: "root",
  };

  test("returns the selected node when it can host components", () => {
    expect(findComponentInsertionParent(snapshot, ["flex-1"], {})).toBe("flex-1");
  });

  test("walks up from non-container selections", () => {
    expect(findComponentInsertionParent(snapshot, ["text-1"], {})).toBe("flex-1");
  });

  test("skips slot-less component selections and uses their parent", () => {
    expect(findComponentInsertionParent(snapshot, ["component-1"], slotlessCatalog)).toBe(
      "flex-1",
    );
  });

  test("falls back to the first screen without a selection", () => {
    expect(findComponentInsertionParent(snapshot, [], {})).toBe("screen-1");
  });

  test("returns null for an empty snapshot", () => {
    expect(findComponentInsertionParent(null, [], {})).toBeNull();
  });
});

describe("findInsertionParent", () => {
  const snapshot = {
    children: [
      {
        children: [
          {
            children: [
              {
                children: [],
                data: { contentHash: "hash-1" },
                id: "component-1",
                type: "component",
              },
              { children: [], id: "text-1", type: "text" },
            ],
            id: "flex-1",
            type: "view",
          },
        ],
        id: "screen-1",
        type: "screen",
      },
      { children: [], id: "screen-2", type: "screen" },
    ],
    id: "root",
    type: "root",
  };

  test("walks up to the nearest parent that accepts the child type", () => {
    expect(findInsertionParent(snapshot, "text", ["text-1"], {})).toBe("flex-1");
    expect(findInsertionParent(snapshot, "view", ["text-1"], {})).toBe("flex-1");
    expect(findInsertionParent(snapshot, "scrollView", ["text-1"], {})).toBe("flex-1");
  });

  test("returns the selected node when it can host the child type", () => {
    expect(findInsertionParent(snapshot, "scrollView", ["screen-1"], {})).toBe("screen-1");
    expect(findInsertionParent(snapshot, "component", ["flex-1"], {})).toBe("flex-1");
  });

  test("preserves the component slot gate for non-component children too", () => {
    // component-1 is slot-less: a view child can't nest inside it, so
    // resolution walks up to its parent.
    expect(findInsertionParent(snapshot, "view", ["component-1"], slotlessCatalog)).toBe("flex-1");
  });

  test("falls back to the first screen when the child can be a screen child", () => {
    expect(findInsertionParent(snapshot, "component", [], {})).toBe("screen-1");
    expect(findInsertionParent(snapshot, "view", [], {})).toBe("screen-1");
  });

  test("returns null when no chain qualifies and a screen cannot host the child", () => {
    // `path` may only nest under `shape`; screens cannot host it, so the
    // screen fallback is skipped.
    expect(findInsertionParent(snapshot, "path", [], {})).toBeNull();
  });

  test("returns null for an empty snapshot", () => {
    expect(findInsertionParent(null, "text", [], {})).toBeNull();
  });
});
