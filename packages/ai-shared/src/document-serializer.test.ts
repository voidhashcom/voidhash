import { ScreenNode, TextNode, ViewNode } from "@voidhash/mimic-schema";
import { Schema } from "effect";
import { describe, expect, test } from "vitest";

import {
  serializeDocument,
  type CleanedDocumentNode,
  type CleanedDocumentStub,
  type SnapshotDocumentNode,
} from "./document-serializer.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeData(prim: any, input: unknown): Record<string, unknown> {
  return prim.data.decode(prim.data.encode(input));
}

const toJsonText = Schema.encodeSync(Schema.UnknownFromJsonString);

/** A cleaned entry is a depth-truncated stub when it carries a `childCount`. */
function isStub(value: CleanedDocumentNode | CleanedDocumentStub): value is CleanedDocumentStub {
  return "childCount" in value;
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

function asNode(
  value: CleanedDocumentNode | CleanedDocumentStub | null | undefined,
): CleanedDocumentNode {
  if (value === null || value === undefined || isStub(value)) {
    expect.fail("expected a cleaned document node");
  }
  return value;
}

function asStub(
  value: CleanedDocumentNode | CleanedDocumentStub | null | undefined,
): CleanedDocumentStub {
  if (value === null || value === undefined || !isStub(value)) {
    expect.fail("expected a depth-truncated stub");
  }
  return value;
}

/** The cleaned child at `index`, asserted to be a full node (not a stub). */
function childNode(node: CleanedDocumentNode, index: number): CleanedDocumentNode {
  return asNode(node.children?.[index]);
}

/** A non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Read `key` off a value that is a record, else `undefined`. */
function field(value: unknown, key: string): unknown {
  if (!isRecord(value)) return undefined;
  return value[key];
}

describe("serializeDocument", () => {
  test("strips schema-default fields, keeping only authored deviations", () => {
    const screen = childNode(asNode(serializeDocument([makeTree()])), 0);
    // screen only deviated in paddingTop
    expect(screen.style).toEqual({ paddingTop: 20 });
    const view = childNode(screen, 0);
    expect(view.style).toEqual({ backgroundColor: "rgba(1, 2, 3, 1)", backgroundEnabled: true });
  });

  test("keeps id, type, name, and authored text", () => {
    const view = childNode(childNode(asNode(serializeDocument([makeTree()])), 0), 0);
    const text = childNode(view, 0);
    expect(text.id).toBe("text1");
    expect(text.type).toBe("text");
    expect(text.name).toBe("Text");
    expect(text.text).toBe("Hello");
  });

  test("omits CRDT internals (pos, parentId)", () => {
    // extra CRDT fields the serializer must drop
    const crdtFields: object = { pos: "aXYZ", parentId: "p" };
    const withPos: SnapshotDocumentNode = {
      id: "n",
      type: "text",
      ...crdtFields,
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
    const stops = field(field(cleaned.style, "backgroundGradient"), "stops");
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
    const screen = childNode(root, 0);
    const view = asStub(screen.children?.[0]);
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
    expect(childNode(sub, 0).id).toBe("text1");
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
    const library = childNode(asNode(serializeDocument([tree])), 0);
    const codeComponent = childNode(library, 0);
    expect(codeComponent.id).toBe("cc1");
    expect(codeComponent.type).toBe("codeComponent");
    expect(codeComponent.path).toBe("components/hero.tsx");
    // The full source is NEVER inlined — only a length stub is present.
    expect(codeComponent).not.toHaveProperty("source");
    expect(codeComponent.sourceLength).toBe(source.length);
    // And the source text does not leak anywhere in the serialized document.
    expect(toJsonText(serializeDocument([tree]))).not.toContain("defineComponent");
  });
});
