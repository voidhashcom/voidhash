import { Document } from "@voidhash/mimic";
import { PaywallDesignerDocument } from "@voidhash/paywall-designer-schema";
import { describe, expect, it } from "vitest";

import {
  addNode,
  moveNode,
  removeNode,
  setNodeStyle,
  setTextContent,
  toSnapshotMetadata,
} from "./designer-ops";

const createDocument = () => {
  const document = Document.make(PaywallDesignerDocument);

  document.transaction((root) => {
    root.set({
      children: [
        {
          children: [],
          type: "screen",
        },
      ],
      name: "Root",
      type: "root",
    });
  });

  return document;
};

const getFirstScreenId = (snapshot: unknown): string => {
  const rootNode = snapshot as { children?: Array<{ id: string }> };
  const firstScreen = rootNode.children?.[0];
  if (!firstScreen) {
    throw new Error("Missing initial screen");
  }
  return firstScreen.id;
};

describe("designer ops", () => {
  it("adds and updates text node", () => {
    const document = createDocument();
    const rootSnapshot = document.root.toSnapshot();
    const screenId = getFirstScreenId(rootSnapshot);

    const textNodeId = addNode(document, {
      nodeType: "text",
      parentId: screenId,
    });

    setTextContent(document, textNodeId, "Hello from MCP");
    setNodeStyle(document, textNodeId, {
      fontSize: 24,
    });

    const snapshot = document.root.toSnapshot();
    const metadata = toSnapshotMetadata(snapshot, textNodeId);

    expect(metadata.nodeCount).toBeGreaterThan(2);

    const screen = (snapshot as { children: Array<{ children: Array<{ id: string; text?: string; style?: { fontSize?: number } }> }> }).children[0];
    expect(screen).toBeDefined();
    if (!screen) {
      throw new Error("Missing screen");
    }
    const textNode = screen.children.find((child) => child.id === textNodeId);
    expect(textNode?.text).toBe("Hello from MCP");
    expect(textNode?.style?.fontSize).toBe(24);
  });

  it("moves and removes nodes", () => {
    const document = createDocument();
    const initialSnapshot = document.root.toSnapshot();
    const screenId = getFirstScreenId(initialSnapshot);

    const firstText = addNode(document, {
      nodeType: "text",
      parentId: screenId,
    });

    const secondText = addNode(document, {
      nodeType: "text",
      parentId: screenId,
    });

    moveNode(document, {
      nodeId: secondText,
      toIndex: 0,
    });

    removeNode(document, firstText);

    const snapshot = document.root.toSnapshot();
    const screen = (snapshot as { children: Array<{ children: Array<{ id: string }> }> }).children[0];
    expect(screen).toBeDefined();
    if (!screen) {
      throw new Error("Missing screen");
    }
    const childIds = screen.children.map((child) => child.id);

    expect(childIds).toContain(secondText);
    expect(childIds).not.toContain(firstText);
  });
});
