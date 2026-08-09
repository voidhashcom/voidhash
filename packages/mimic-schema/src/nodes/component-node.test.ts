import {
  createClientDocument,
  type DocumentTransport,
  type ServerMessage,
  type TransactionEnvelope,
} from "@voidhash/mimic";
import { type Value } from "@voidhash/mimic-core";
import { constant } from "@voidhash/lib/lang";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { createInitialPaywallDocumentInput, PaywallDesignerDocument } from "../document.ts";
import { ComponentNode, type ComponentNodeData } from "./component-node.ts";
import { RootNode } from "./root-node.ts";
import { ScreenNode } from "./screen-node.ts";
import { ShapeNode } from "./shape-node.ts";
import { TextNode } from "./text-node.ts";
import { ViewNode } from "./view-node.ts";

class StubTransport implements DocumentTransport {
  readonly submitted: TransactionEnvelope[] = [];

  connect(): Promise<void> {
    return Effect.runPromise(Effect.void);
  }
  disconnect(): void {}
  subscribe(_handler: (message: ServerMessage) => void): () => void {
    return () => {};
  }
  subscribeConnection(_handler: (connected: boolean) => void): () => void {
    return () => {};
  }
  requestSnapshot(): void {}
  submit(transaction: TransactionEnvelope): void {
    this.submitted.push(transaction);
  }
  setPresence(_data: Value): void {}
  clearPresence(): void {}
  isConnected(): boolean {
    return false;
  }
}

function createOfflineDocument() {
  return createClientDocument({
    primitive: PaywallDesignerDocument,
    transport: new StubTransport(),
    initialValue: PaywallDesignerDocument.encode(createInitialPaywallDocumentInput()),
  });
}

// Snapshot children are widened by the recursion-breaking ComponentNode
// annotation, so component nodes are narrowed structurally before assertions.
function isComponentNodeData(node: { readonly type: string }): node is ComponentNodeData {
  return node.type === "component";
}

function narrowToComponent(node: { readonly type: string } | undefined): ComponentNodeData {
  expect(node).toBeDefined();
  if (node === undefined || !isComponentNodeData(node)) {
    return Effect.runSync(Effect.die(new Error(`expected a component node, got ${node?.type}`)));
  }
  return node;
}

function makeDocumentWithComponent() {
  const doc = createOfflineDocument();
  const ids = { componentId: "", viewId: "", rootId: "", screenId: "" };
  doc.transaction((root) => {
    const rootNode = root.children.first()!;
    ids.rootId = rootNode.id;
    const screen = rootNode.children.first()!;
    ids.screenId = screen.id;
    const view = screen.children.insertLast({ type: "view" });
    ids.viewId = view.id;
    const component = view.children.insertLast({
      type: "component",
      componentSlug: "product-option",
      componentVersion: 2,
      contentHash: "ab93f1",
    });
    ids.componentId = component.id;
  });
  return { doc, ids };
}

function findComponentSnapshot(
  doc: ReturnType<typeof makeDocumentWithComponent>["doc"],
): ComponentNodeData {
  const roots = doc.getSnapshot();
  expect(roots).toBeDefined();
  const screen = roots![0]!.children[0];
  expect(screen).toBeDefined();
  const view = screen!.children[0];
  expect(view).toBeDefined();
  return narrowToComponent(view!.children[0]);
}

describe("ComponentNode", () => {
  test("declares allowed children including itself", () => {
    expect(ComponentNode.type).toBe("component");
    expect(ComponentNode.isChildAllowed("view")).toBe(true);
    expect(ComponentNode.isChildAllowed("text")).toBe(true);
    expect(ComponentNode.isChildAllowed("shape")).toBe(true);
    expect(ComponentNode.isChildAllowed("component")).toBe(true);
    expect(ComponentNode.isChildAllowed("screen")).toBe(false);
    expect(ComponentNode.isChildAllowed("path")).toBe(false);
  });

  test("is an allowed child of screen and view but not of root/text/shape", () => {
    expect(ScreenNode.isChildAllowed("component")).toBe(true);
    expect(ViewNode.isChildAllowed("component")).toBe(true);
    expect(RootNode.isChildAllowed("component")).toBe(false);
    expect(TextNode.isChildAllowed("component")).toBe(false);
    expect(ShapeNode.isChildAllowed("component")).toBe(false);
  });

  test("inserts with required fields and applies defaults", () => {
    const { doc } = makeDocumentWithComponent();
    const component = findComponentSnapshot(doc);

    expect(component.type).toBe("component");
    expect(component.data.componentSlug).toBe("product-option");
    expect(component.data.componentVersion).toBe(2);
    expect(component.data.contentHash).toBe("ab93f1");
    expect(component.data.name).toBe("Component");
    expect(component.data.previewState).toBe("default");
    expect(component.data.props).toEqual([]);
    expect(component.data.actionBindings).toEqual([]);
    expect(component.children).toEqual([]);
  });

  test("admits builtin instances: slug-resolved, unpinned identity fields stay at sentinels", () => {
    const doc = createOfflineDocument();
    doc.transaction((root) => {
      const screen = root.children.first()!.children.first()!;
      screen.children.insertLast({
        type: "component",
        componentSource: "builtin",
        componentSlug: "sample-badge",
      });
    });

    const roots = doc.getSnapshot();
    const builtin = narrowToComponent(roots![0]!.children[0]!.children[0]);
    expect(builtin.data.componentSource).toBe("builtin");
    expect(builtin.data.componentSlug).toBe("sample-badge");
    // Builtins are UNPINNED: version/hash/path stay at their defaults.
    expect(builtin.data.componentVersion).toBe(0);
    expect(builtin.data.contentHash).toBe("");
    expect(builtin.data.componentPath).toBe("");
  });

  test("pushes prop entries with unique ids and positions", () => {
    const { doc, ids } = makeDocumentWithComponent();

    doc.transaction((root) => {
      const component = root.findByIdAcrossTree(ids.componentId)!.as(ComponentNode);
      component.data.props.push({
        name: "accentColor",
        value: { type: "literal", value: { key: "string", value: "#16a34a" } },
      });
      component.data.props.push({
        name: "selected",
        value: { type: "variable-reference", value: { id: "var-1" } },
      });
      component.data.actionBindings.push({
        action: {
          type: "set-variable",
          payload: {
            newValue: { type: "action-payload", value: { field: "productId" } },
            variableId: "var-1",
          },
        },
        name: "onSelect",
      });
    });

    const component = findComponentSnapshot(doc);

    expect(component.data.props).toHaveLength(2);
    const firstProp = component.data.props[0]!;
    // Array entries are wrapped as {id, pos, value} on the wire/snapshot.
    expect(typeof firstProp.id).toBe("string");
    expect(typeof firstProp.pos).toBe("string");
    expect(new Set(component.data.props.map((prop) => prop.id)).size).toBe(2);
    expect(new Set(component.data.props.map((prop) => prop.pos)).size).toBe(2);
    expect(firstProp.value?.name).toBe("accentColor");
    expect(firstProp.value?.value).toEqual({
      type: "literal",
      value: { key: "string", value: "#16a34a" },
    });
    expect(component.data.props[1]!.value?.value).toEqual({
      type: "variable-reference",
      value: { id: "var-1" },
    });

    expect(component.data.actionBindings).toHaveLength(1);
    const binding = component.data.actionBindings[0]!;
    expect(binding.value?.name).toBe("onSelect");
    expect(binding.value?.action).toEqual({
      type: "set-variable",
      payload: {
        newValue: { type: "action-payload", value: { field: "productId" } },
        variableId: "var-1",
      },
    });
  });

  test("writes prop entries via whole-array sets", () => {
    const { doc, ids } = makeDocumentWithComponent();

    doc.transaction((root) => {
      const component = root.findByIdAcrossTree(ids.componentId)!.as(ComponentNode);
      component.data.props.set([
        {
          name: "accentColor",
          value: { type: "literal", value: { key: "string", value: "#16a34a" } },
        },
        {
          name: "selected",
          value: { type: "variable-reference", value: { id: "var-1" } },
        },
      ]);
    });

    const component = findComponentSnapshot(doc);
    expect(component.data.props).toHaveLength(2);
    expect(new Set(component.data.props.map((prop) => prop.id)).size).toBe(2);
    expect(new Set(component.data.props.map((prop) => prop.pos)).size).toBe(2);
    expect(component.data.props[0]!.value?.name).toBe("accentColor");
    expect(component.data.props[1]!.value?.name).toBe("selected");
  });

  test("nests component and visual children inside a component", () => {
    const { doc, ids } = makeDocumentWithComponent();

    doc.transaction((root) => {
      const component = root.findByIdAcrossTree(ids.componentId)!.as(ComponentNode);
      const nestedView = component.children.insertLast({ type: "view" });
      component.children.insertLast({
        type: "component",
        componentSlug: "badge",
        componentVersion: 1,
        contentHash: "deadbeef",
      });
      nestedView.as(ViewNode).children.insertLast({
        type: "component",
        componentSlug: "icon",
        componentVersion: 1,
        contentHash: "feedface",
      });
    });

    const component = findComponentSnapshot(doc);
    expect(component.children).toHaveLength(2);
    expect(component.children[0]!.type).toBe("view");
    expect(component.children[0]!.children[0]!.type).toBe("component");
    const badge = narrowToComponent(component.children[1]);
    expect(badge.data.componentSlug).toBe("badge");
  });

  test("rejects inserting a component under disallowed parents", () => {
    const doc = createOfflineDocument();
    const ids = { rootId: "", screenId: "", textId: "" };
    doc.transaction((root) => {
      const rootNode = root.children.first()!;
      ids.rootId = rootNode.id;
      const screen = rootNode.children.first()!;
      ids.screenId = screen.id;
      ids.textId = screen.children.insertLast({ type: "text" }).id;
    });

    const componentData = constant({
      type: "component",
      componentSlug: "product-option",
      componentVersion: 1,
      contentHash: "ab93f1",
    });

    expect(() =>
      doc.transaction((root) =>
        root.findByIdAcrossTree(ids.textId)!.children.insertLast(componentData),
      ),
    ).toThrow();
    expect(() =>
      doc.transaction((root) =>
        root.findByIdAcrossTree(ids.rootId)!.children.insertLast(componentData),
      ),
    ).toThrow();
    doc.transaction((root) =>
      root.findByIdAcrossTree(ids.screenId)!.children.insertLast(componentData),
    );
  });
});
