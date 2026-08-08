import type { ComponentManifest } from "@voidhash/core/services/paywallDeploys/PaywallDeployManifest";
import { describe, expect, test } from "vite-plus/test";

import {
  collectAncestorVariableIds,
  validateComponentNode,
  type ComponentNodeValidationInput,
} from "./component-validation";

function makeManifest(overrides: Partial<ComponentManifest> = {}): ComponentManifest {
  return {
    actions: {},
    manifestVersion: 2,
    props: {},
    ...overrides,
  };
}

function makeNode(overrides: Partial<ComponentNodeValidationInput> = {}): ComponentNodeValidationInput {
  return {
    actionBindings: [],
    contentHash: "a".repeat(64),
    props: [],
    ...overrides,
  };
}

const NO_VARIABLES: ReadonlySet<string> = new Set();

describe("validateComponentNode", () => {
  test("reports manifest-missing when the pinned hash is absent from the catalog", () => {
    const warnings = validateComponentNode(makeNode(), undefined, NO_VARIABLES);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: "manifest-missing", severity: "warning" });
  });

  test("returns no warnings for a node matching its manifest", () => {
    const manifest = makeManifest({
      actions: { onSelect: { payload: { productId: { kind: "string" } } } },
      props: {
        title: { default: "Hello", kind: "string" },
      },
    });
    const node = makeNode({
      actionBindings: [
        {
          id: "ab-1",
          pos: "a1",
          value: { action: { type: "close-paywall" }, name: "onSelect" },
        },
      ],
      props: [
        {
          id: "p-1",
          pos: "a1",
          value: {
            name: "title",
            localizedValues: [],
            value: { type: "literal", value: { key: "string", value: "Hi" } },
          },
        },
      ],
    });
    expect(validateComponentNode(node, manifest, NO_VARIABLES)).toEqual([]);
  });

  test("reports unknown prop names", () => {
    const node = makeNode({
      props: [
        {
          id: "p-1",
          pos: "a1",
          value: {
            name: "ghost",
            localizedValues: [],
            value: { type: "literal", value: { key: "string", value: "x" } },
          },
        },
      ],
    });
    const warnings = validateComponentNode(node, makeManifest(), NO_VARIABLES);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: "unknown-prop", propName: "ghost" });
  });

  test("reports prop kind mismatches with the expected stored key", () => {
    const manifest = makeManifest({
      props: {
        count: { kind: "number" },
        tags: { item: { kind: "string" }, kind: "array" },
        theme: { kind: "select", options: ["light", "dark"] },
      },
    });
    const node = makeNode({
      props: [
        {
          id: "p-1",
          pos: "a1",
          value: {
            name: "count",
            localizedValues: [],
            value: { type: "literal", value: { key: "string", value: "5" } },
          },
        },
        {
          id: "p-2",
          pos: "a2",
          value: {
            name: "theme",
            localizedValues: [],
            value: { type: "literal", value: { key: "string", value: "light" } },
          },
        },
        {
          id: "p-3",
          pos: "a3",
          value: {
            name: "tags",
            localizedValues: [],
            value: { type: "literal", value: { key: "number-array", value: [] } },
          },
        },
      ],
    });
    const warnings = validateComponentNode(node, manifest, NO_VARIABLES);
    expect(warnings).toHaveLength(2);
    expect(warnings).toContainEqual(
      expect.objectContaining({
        expectedKey: "number",
        kind: "prop-kind-mismatch",
        propName: "count",
        storedKey: "string",
      }),
    );
    expect(warnings).toContainEqual(
      expect.objectContaining({
        expectedKey: "string-array",
        kind: "prop-kind-mismatch",
        propName: "tags",
        storedKey: "number-array",
      }),
    );
  });

  test("does not kind-check variable-reference bindings", () => {
    const manifest = makeManifest({ props: { count: { kind: "number" } } });
    const node = makeNode({
      props: [
        {
          id: "p-1",
          pos: "a1",
          value: {
            name: "count",
            localizedValues: [],
            value: { type: "variable-reference", value: { id: "var-1" } },
          },
        },
      ],
    });
    expect(validateComponentNode(node, manifest, new Set(["var-1"]))).toEqual([]);
  });

  test("flags missing required props without defaults, info-level for uneditable kinds", () => {
    const manifest = makeManifest({
      props: {
        items: { item: { kind: "component" }, kind: "array" },
        slotComponent: { kind: "component" },
        subtitle: { kind: "string", optional: true },
        title: { kind: "string" },
        titled: { default: "x", kind: "string" },
      },
    });
    const warnings = validateComponentNode(makeNode(), manifest, NO_VARIABLES);
    expect(warnings).toHaveLength(3);
    expect(warnings).toContainEqual(
      expect.objectContaining({
        kind: "missing-required-prop",
        propName: "title",
        severity: "warning",
      }),
    );
    expect(warnings).toContainEqual(
      expect.objectContaining({
        kind: "missing-required-prop",
        propName: "slotComponent",
        severity: "info",
      }),
    );
    expect(warnings).toContainEqual(
      expect.objectContaining({
        kind: "missing-required-prop",
        propName: "items",
        severity: "info",
      }),
    );
  });

  test("reports dangling variable references on prop bindings even without a manifest", () => {
    const node = makeNode({
      props: [
        {
          id: "p-1",
          pos: "a1",
          value: {
            name: "title",
            localizedValues: [],
            value: { type: "variable-reference", value: { id: "var-gone" } },
          },
        },
      ],
    });
    const warnings = validateComponentNode(node, undefined, new Set(["var-other"]));
    expect(warnings).toContainEqual(
      expect.objectContaining({
        kind: "dangling-variable-reference",
        source: "title",
        variableId: "var-gone",
      }),
    );
  });

  test("reports bindings to undeclared actions", () => {
    const node = makeNode({
      actionBindings: [
        {
          id: "ab-1",
          pos: "a1",
          value: { action: { type: "none" }, name: "onGhost" },
        },
      ],
    });
    const warnings = validateComponentNode(node, makeManifest(), NO_VARIABLES);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ actionName: "onGhost", kind: "unknown-action" });
  });

  test("reports unknown payload fields for action-payload sources", () => {
    const manifest = makeManifest({
      actions: { onSelect: { payload: { productId: { kind: "string" } } } },
    });
    const node = makeNode({
      actionBindings: [
        {
          id: "ab-1",
          pos: "a1",
          value: {
            action: {
              payload: { field: "ghostField", type: "action-payload" },
              type: "purchase-product",
            },
            name: "onSelect",
          },
        },
        {
          id: "ab-2",
          pos: "a2",
          value: {
            action: {
              payload: {
                newValue: {
                  type: "action-payload",
                  value: { field: "productId" },
                },
                variableId: "var-1",
              },
              type: "set-variable",
            },
            name: "onSelect",
          },
        },
      ],
    });
    const warnings = validateComponentNode(node, manifest, new Set(["var-1"]));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      actionName: "onSelect",
      field: "ghostField",
      kind: "unknown-action-payload-field",
    });
  });

  test("reports dangling variable references inside action bindings", () => {
    const manifest = makeManifest({
      actions: { onSelect: { payload: {} } },
    });
    const node = makeNode({
      actionBindings: [
        {
          id: "ab-1",
          pos: "a1",
          value: {
            action: {
              payload: {
                newValue: { type: "variable-reference", value: { id: "var-b" } },
                variableId: "var-a",
              },
              type: "set-variable",
            },
            name: "onSelect",
          },
        },
        {
          id: "ab-2",
          pos: "a2",
          value: {
            action: {
              payload: { type: "variable-reference", variableId: "var-c" },
              type: "purchase-product",
            },
            name: "onSelect",
          },
        },
      ],
    });
    const warnings = validateComponentNode(node, manifest, new Set(["var-a"]));
    expect(warnings).toHaveLength(2);
    expect(warnings).toContainEqual(
      expect.objectContaining({ kind: "dangling-variable-reference", variableId: "var-b" }),
    );
    expect(warnings).toContainEqual(
      expect.objectContaining({ kind: "dangling-variable-reference", variableId: "var-c" }),
    );
  });

  test("warns when children exist but the manifest declares slot: false", () => {
    const manifest = makeManifest({ slot: false });
    const node = makeNode({ children: [{ id: "child-1" }] });
    const warnings = validateComponentNode(node, manifest, NO_VARIABLES);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: "children-without-slot", severity: "warning" });
  });

  test("allows children when slot is true or undeclared", () => {
    const node = makeNode({ children: [{ id: "child-1" }] });
    expect(validateComponentNode(node, makeManifest({ slot: true }), NO_VARIABLES)).toEqual([]);
    expect(validateComponentNode(node, makeManifest(), NO_VARIABLES)).toEqual([]);
  });
});

describe("collectAncestorVariableIds", () => {
  const snapshot = {
    children: [
      {
        children: [
          {
            children: [],
            data: { localVariables: [] },
            id: "component-1",
            type: "component",
          },
          {
            children: [],
            data: { localVariables: [{ id: "entry-sibling", value: { id: "var-sibling" } }] },
            id: "flex-sibling",
            type: "view",
          },
        ],
        data: { localVariables: [{ id: "entry-screen", value: { id: "var-screen" } }] },
        id: "screen-1",
        type: "screen",
      },
    ],
    data: { localVariables: [] },
    id: "root",
    type: "root",
  };

  test("collects entry and internal ids from the ancestor chain only", () => {
    const ids = collectAncestorVariableIds(snapshot, "component-1");
    expect(ids.has("var-screen")).toBe(true);
    expect(ids.has("entry-screen")).toBe(true);
    expect(ids.has("var-sibling")).toBe(false);
    expect(ids.has("entry-sibling")).toBe(false);
  });

  test("returns an empty set for unknown nodes", () => {
    expect(collectAncestorVariableIds(snapshot, "missing").size).toBe(0);
  });

  test("returns an empty set for a null snapshot", () => {
    expect(collectAncestorVariableIds(null, "component-1").size).toBe(0);
  });
});
