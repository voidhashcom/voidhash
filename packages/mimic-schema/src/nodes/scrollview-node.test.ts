import {
  createClientDocument,
  type DocumentTransport,
  type ServerMessage,
  type TransactionEnvelope,
} from "@voidhash/mimic";
import { type Value } from "@voidhash/mimic-core";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { createInitialPaywallDocumentInput, PaywallDesignerDocument } from "../document.ts";
import { ComponentNode } from "./component-node.ts";
import { RootNode } from "./root-node.ts";
import { ScreenNode } from "./screen-node.ts";
import { ScrollViewNode, type ScrollViewNodeData } from "./scrollview-node.ts";
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

function makeDocumentWithScrollView() {
  const doc = createOfflineDocument();
  const ids = { rootId: "", screenId: "", scrollViewId: "" };
  doc.transaction((root) => {
    const rootNode = root.children.first()!;
    ids.rootId = rootNode.id;
    const screen = rootNode.children.first()!;
    ids.screenId = screen.id;
    const scrollView = screen.children.insertLast({ type: "scrollView" });
    ids.scrollViewId = scrollView.id;
  });
  return { doc, ids };
}

// Snapshot children are widened by the recursion-breaking ScrollViewNode
// annotation, so scrollView nodes are narrowed structurally before assertions.
function isScrollViewNodeData(node: { readonly type: string }): node is ScrollViewNodeData {
  return node.type === "scrollView";
}

function findScrollViewSnapshot(
  doc: ReturnType<typeof makeDocumentWithScrollView>["doc"],
): ScrollViewNodeData {
  const roots = doc.getSnapshot();
  expect(roots).toBeDefined();
  const screen = roots![0]!.children[0];
  expect(screen).toBeDefined();
  const scrollView = screen!.children[0];
  expect(scrollView).toBeDefined();
  expect(scrollView!.type).toBe("scrollView");
  if (scrollView === undefined || !isScrollViewNodeData(scrollView)) {
    return Effect.runSync(Effect.die(new Error("expected a scrollView node")));
  }
  return scrollView;
}

describe("ScrollViewNode", () => {
  test("declares the same allowed children as a view, including itself", () => {
    expect(ScrollViewNode.type).toBe("scrollView");
    expect(ScrollViewNode.isChildAllowed("view")).toBe(true);
    expect(ScrollViewNode.isChildAllowed("scrollView")).toBe(true);
    expect(ScrollViewNode.isChildAllowed("text")).toBe(true);
    expect(ScrollViewNode.isChildAllowed("shape")).toBe(true);
    expect(ScrollViewNode.isChildAllowed("component")).toBe(true);
    expect(ScrollViewNode.isChildAllowed("screen")).toBe(false);
    expect(ScrollViewNode.isChildAllowed("path")).toBe(false);
  });

  test("is an allowed child of screen and view but not root/text/shape", () => {
    expect(ScreenNode.isChildAllowed("scrollView")).toBe(true);
    expect(ViewNode.isChildAllowed("scrollView")).toBe(true);
    expect(RootNode.isChildAllowed("scrollView")).toBe(false);
    expect(TextNode.isChildAllowed("scrollView")).toBe(false);
    expect(ShapeNode.isChildAllowed("scrollView")).toBe(false);
    expect(ComponentNode.isChildAllowed("scrollView")).toBe(true);
  });

  test("inserts with RN ScrollView defaults", () => {
    const { doc } = makeDocumentWithScrollView();
    const scrollView = findScrollViewSnapshot(doc);

    expect(scrollView.data.name).toBe("ScrollView");
    expect(scrollView.data.horizontal).toBe(false);
    expect(scrollView.data.showsScrollIndicator).toBe(true);
    expect(scrollView.data.states).toEqual([]);
    expect(scrollView.data.localized).toEqual([]);
    expect(scrollView.children).toEqual([]);
  });

  test("honors explicit horizontal / showsScrollIndicator values", () => {
    const { doc, ids } = makeDocumentWithScrollView();

    doc.transaction((root) => {
      const scrollView = root.findByIdAcrossTree(ids.scrollViewId)!.as(ScrollViewNode);
      scrollView.data.horizontal.set(true);
      scrollView.data.showsScrollIndicator.set(false);
    });

    const scrollView = findScrollViewSnapshot(doc);
    expect(scrollView.data.horizontal).toBe(true);
    expect(scrollView.data.showsScrollIndicator).toBe(false);
  });

  test("nests visual children inside a scrollView", () => {
    const { doc, ids } = makeDocumentWithScrollView();

    doc.transaction((root) => {
      const scrollView = root.findByIdAcrossTree(ids.scrollViewId)!.as(ScrollViewNode);
      scrollView.children.insertLast({ type: "view" });
      scrollView.children.insertLast({ type: "text" });
      scrollView.children.insertLast({ type: "scrollView" });
    });

    const scrollView = findScrollViewSnapshot(doc);
    expect(scrollView.children).toHaveLength(3);
    expect(scrollView.children.map((child) => child.type)).toEqual([
      "view",
      "text",
      "scrollView",
    ]);
  });

  test("rejects inserting a scrollView under disallowed parents", () => {
    const doc = createOfflineDocument();
    const ids = { rootId: "", screenId: "", textId: "" };
    doc.transaction((root) => {
      const rootNode = root.children.first()!;
      ids.rootId = rootNode.id;
      const screen = rootNode.children.first()!;
      ids.screenId = screen.id;
      ids.textId = screen.children.insertLast({ type: "text" }).id;
    });

    expect(() =>
      doc.transaction((root) =>
        root.findByIdAcrossTree(ids.textId)!.children.insertLast({ type: "scrollView" }),
      ),
    ).toThrow();
    expect(() =>
      doc.transaction((root) =>
        root.findByIdAcrossTree(ids.rootId)!.children.insertLast({ type: "scrollView" }),
      ),
    ).toThrow();
    doc.transaction((root) =>
      root.findByIdAcrossTree(ids.screenId)!.children.insertLast({ type: "scrollView" }),
    );
  });
});
