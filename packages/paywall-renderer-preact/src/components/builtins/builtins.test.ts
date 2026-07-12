import { BUILTIN_COMPONENTS } from "@voidhash/paywall-builtins";
import type {
  ComponentSnapshotNode,
  SnapshotNode,
  VariableReader,
  VariableValue,
} from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import { renderPaywall } from "../../render";
import { BUILTIN_RENDERERS } from "./renderers";
import { resolveComponentInstanceProps } from "./resolve-props";

type PropEntries = ComponentSnapshotNode["data"]["props"];

function makePropEntries(
  entries: ReadonlyArray<{ name: string; value: unknown }>,
): PropEntries {
  return entries.map((entry, index) => ({
    id: `prop-${index}`,
    pos: `a${index}`,
    value: entry,
  })) as unknown as PropEntries;
}

function makeBuiltinNode(id: string, slug: string, props: PropEntries): SnapshotNode {
  return {
    type: "component",
    id,
    parentId: null,
    pos: "a0",
    data: {
      name: "Component",
      componentSource: "builtin",
      componentPath: "",
      componentSlug: slug,
      componentVersion: 0,
      contentHash: "",
      previewState: "default",
      props,
      actionBindings: [],
    },
    children: [],
  } as unknown as SnapshotNode;
}

function makeRootNode(children: SnapshotNode[]): SnapshotNode {
  return {
    type: "root",
    id: "root",
    parentId: null,
    pos: "a0",
    data: { name: "Paywall" },
    children,
  } as unknown as SnapshotNode;
}

describe("builtin renderer registry", () => {
  test("mirrors the metadata registry in @voidhash/paywall-builtins", () => {
    expect(Object.keys(BUILTIN_RENDERERS).sort()).toEqual(
      Object.keys(BUILTIN_COMPONENTS).sort(),
    );
  });
});

describe("resolveComponentInstanceProps", () => {
  const variables: VariableReader = new Map<string, VariableValue>([
    ["var-1", { key: "string", value: "from-variable" }],
  ]);

  test("unwraps literal bindings and resolves variable references", () => {
    const resolved = resolveComponentInstanceProps(
      makePropEntries([
        { name: "label", value: { type: "literal", value: { key: "string", value: "Pro" } } },
        { name: "bound", value: { type: "variable-reference", value: { id: "var-1" } } },
      ]),
      variables,
    );
    expect(resolved).toEqual({ label: "Pro", bound: "from-variable" });
  });

  test("omits unresolvable references and malformed entries", () => {
    const resolved = resolveComponentInstanceProps(
      makePropEntries([
        { name: "missing", value: { type: "variable-reference", value: { id: "nope" } } },
        { name: "", value: { type: "literal", value: { key: "string", value: "x" } } },
      ]),
      variables,
    );
    expect(resolved).toEqual({});
  });
});

describe("builtin component rendering", () => {
  test("renders the real builtin implementation with resolved document props", () => {
    const snapshot = makeRootNode([
      makeBuiltinNode(
        "builtin-1",
        "sample-badge",
        makePropEntries([
          { name: "label", value: { type: "literal", value: { key: "string", value: "Pro" } } },
        ]),
      ),
    ]);

    const { html } = renderPaywall(snapshot);

    expect(html).toContain('data-node-id="builtin-1"');
    expect(html).toContain(">Pro</span>");
  });

  test("degrades an unknown builtin slug to the labeled placeholder", () => {
    const snapshot = makeRootNode([
      makeBuiltinNode("builtin-1", "no-such-builtin", makePropEntries([])),
    ]);

    const { html } = renderPaywall(snapshot);

    expect(html).toContain("Component &quot;no-such-builtin&quot; preview unavailable");
  });
});
