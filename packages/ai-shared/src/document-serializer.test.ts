import { ScreenNode, TextNode, ViewNode } from "@voidhash/mimic-schema";
import { describe, expect, test } from "vitest";

import {
  serializeDocument,
  type CleanedDocumentNode,
  type CleanedDocumentStub,
  type SnapshotDocumentNode,
} from "./document-serializer.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeData(prim: any, input: unknown): Record<string, unknown> {
  return prim.data.decode(prim.data.encode(input)) as Record<string, unknown>;
}

/** A tree whose nodes carry CRDT `pos`/`parentId` alongside decoded `data`. */
function makeTree(): SnapshotDocumentNode {
  return {
    id: "root1",
    type: "root",
    data: {},
    children: [
      {
        id: "screen1",
        type: "screen",
        // one authored deviation: paddingTop
        data: decodeData(ScreenNode, { style: { paddingTop: 20 } }),
        children: [
          {
            id: "view1",
            type: "view",
            data: decodeData(ViewNode, {
              style: { backgroundColor: "rgba(1, 2, 3, 1)", backgroundEnabled: true },
            }),
            children: [
              {
                id: "text1",
                type: "text",
                data: decodeData(TextNode, { text: "Hello" }),
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function asNode(v: unknown): CleanedDocumentNode {
  return v as CleanedDocumentNode;
}

describe("serializeDocument", () => {
  test("strips schema-default fields, keeping only authored deviations", () => {
    const screen = asNode(serializeDocument([makeTree()])).children![0] as CleanedDocumentNode;
    // screen only deviated in paddingTop
    expect(screen.style).toEqual({ paddingTop: 20 });
    const view = screen.children![0] as CleanedDocumentNode;
    expect(view.style).toEqual({ backgroundColor: "rgba(1, 2, 3, 1)", backgroundEnabled: true });
  });

  test("keeps id, type, name, and authored text", () => {
    const view = (asNode(serializeDocument([makeTree()])).children![0] as CleanedDocumentNode)
      .children![0] as CleanedDocumentNode;
    const text = view.children![0] as CleanedDocumentNode;
    expect(text.id).toBe("text1");
    expect(text.type).toBe("text");
    expect(text.name).toBe("Text");
    expect(text.text).toBe("Hello");
  });

  test("omits CRDT internals (pos, parentId)", () => {
    const withPos: SnapshotDocumentNode = {
      id: "n",
      type: "text",
      // extra CRDT fields the serializer must drop
      ...({ pos: "aXYZ", parentId: "p" } as object),
      data: decodeData(TextNode, { text: "Hi" }),
      children: [],
    };
    const cleaned = asNode(serializeDocument([withPos]));
    expect(cleaned).not.toHaveProperty("pos");
    expect(cleaned).not.toHaveProperty("parentId");
    expect(cleaned.id).toBe("n");
  });

  test("unwraps {id,pos,value} array envelopes (gradient stops)", () => {
    // enabling a gradient background surfaces the stops array (entry-wrapped when decoded)
    const viewData = decodeData(ViewNode, {
      style: { backgroundEnabled: true, backgroundType: "gradient" },
    });
    const tree: SnapshotDocumentNode = {
      id: "v",
      type: "view",
      data: viewData,
      children: [],
    };
    const cleaned = asNode(serializeDocument([tree]));
    const stops = (cleaned.style as { backgroundGradient?: { stops?: unknown[] } })?.backgroundGradient
      ?.stops;
    // If the gradient differs from default it is present; when present, its stops
    // must be plain {color,position} objects, NOT {id,pos,value} envelopes.
    if (Array.isArray(stops)) {
      for (const stop of stops) {
        expect(stop).not.toHaveProperty("pos");
        expect(stop).not.toHaveProperty("id");
        expect(stop).toHaveProperty("color");
      }
    }
  });

  test("depth limit renders deeper nodes as stubs with childCount", () => {
    const root = asNode(serializeDocument([makeTree()], { depth: 1 }));
    const screen = root.children![0] as CleanedDocumentNode;
    const view = screen.children![0] as CleanedDocumentStub;
    expect(view.id).toBe("view1");
    expect(view.type).toBe("view");
    expect(view.childCount).toBe(1);
    // a stub carries no style / children arrays
    expect(view).not.toHaveProperty("style");
    expect(view).not.toHaveProperty("children");
  });

  test("nodeId selects a subtree root", () => {
    const sub = asNode(serializeDocument([makeTree()], { nodeId: "view1" }));
    expect(sub.id).toBe("view1");
    expect(sub.type).toBe("view");
    // its child text node is present
    expect((sub.children![0] as CleanedDocumentNode).id).toBe("text1");
  });

  test("returns null when nodeId matches nothing", () => {
    expect(serializeDocument([makeTree()], { nodeId: "nope" })).toBeNull();
  });

  test("returns null for an empty forest", () => {
    expect(serializeDocument([])).toBeNull();
  });

  test("a codeComponent node emits path + a source stub, never the source text", () => {
    const source = "export default defineComponent({ render: () => null });";
    const tree: SnapshotDocumentNode = {
      id: "root1",
      type: "root",
      data: {},
      children: [
        {
          id: "lib1",
          type: "library",
          data: {},
          children: [
            {
              id: "cc1",
              type: "codeComponent",
              data: { path: "components/hero.tsx", source },
              children: [],
            },
          ],
        },
      ],
    };
    const library = asNode(serializeDocument([tree])).children![0] as CleanedDocumentNode;
    const codeComponent = library.children![0] as CleanedDocumentNode;
    expect(codeComponent.id).toBe("cc1");
    expect(codeComponent.type).toBe("codeComponent");
    expect(codeComponent.path).toBe("components/hero.tsx");
    // The full source is NEVER inlined — only a length stub is present.
    expect(codeComponent).not.toHaveProperty("source");
    expect(codeComponent.sourceLength).toBe(source.length);
    // And the source text does not leak anywhere in the serialized document.
    expect(JSON.stringify(serializeDocument([tree]))).not.toContain("defineComponent");
  });
});
