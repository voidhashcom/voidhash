import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import {
  buildScreenContainerStyles,
  buildViewStyles,
} from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../../testing/offline-document";
import { documentRootFromSnapshot } from "../../utils/document-root";
import { resolveEffectiveStyle } from "../../utils/state-overrides";
import { findNodeById } from "../../utils/tree";
import { applyStyleUpdate, type StyleTarget } from "./style-action-helpers";

// Path-faithful coverage of what the CANVAS actually paints. The existing
// fill-gradient-writes suite proves writes persist the logical stop shape; this
// suite drives the READ side the renderer uses — real CRDT document ->
// snapshot -> resolveEffectiveStyle -> buildViewStyles/buildScreenContainerStyles
// -> buildBackgroundStyles -> DOM `style` — asserting a non-solid fill paints a
// real `backgroundImage` rather than silently collapsing to transparent.

function makeDesignerDoc() {
  const doc = createOfflineDesignerDocument();
  const { screenId } = seededIds(doc);
  let viewId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    viewId = screen.children.insertLast({ type: "view", name: "Card" }).id;
  });
  return { doc, viewId, screenId };
}

function mimicOf(doc: OfflineDesignerDocument) {
  return { document: doc, snapshot: doc.getSnapshot() } as never;
}

const apply = (doc: OfflineDesignerDocument, target: StyleTarget, style: Record<string, unknown>) =>
  applyStyleUpdate(mimicOf(doc), [target], style, {}, ((fn: never) => doc.transaction(fn)) as never);

/** Reads a node's effective style exactly as the canvas node-renderers do. */
function effectiveStyle(doc: OfflineDesignerDocument, nodeId: string): Record<string, unknown> {
  const root = documentRootFromSnapshot(doc.getSnapshot());
  const node = findNodeById<SnapshotNode>(root as never, nodeId);
  if (!node) throw new Error("expected the node in the snapshot");
  return resolveEffectiveStyle(node as never, null);
}

const GRADIENT_URL_PREFIX = 'url("data:image/svg+xml,';

describe("fill render (path-faithful)", () => {
  test("a gradient view paints an SVG data-URI backgroundImage", () => {
    const { doc, viewId } = makeDesignerDoc();
    const target: StyleTarget = { nodeId: viewId, nodeType: "view" };

    apply(doc, target, {
      backgroundEnabled: true,
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        stops: [
          { color: "rgba(255, 0, 0, 1)", position: 0 },
          { color: "rgba(0, 0, 255, 1)", position: 1 },
        ],
      },
    });

    const rendered = buildViewStyles(effectiveStyle(doc, viewId) as never);
    // Before the fix: the wrapped-stop read path was fine, but any shape drift
    // (or reading `.value` on a logical stop) collapsed this to transparent.
    expect(rendered.backgroundColor).toBeUndefined();
    expect(String(rendered.backgroundImage)).toContain(GRADIENT_URL_PREFIX);
    const svg = decodeURIComponent(
      /^url\("data:image\/svg\+xml,(.*)"\)$/.exec(String(rendered.backgroundImage))![1]!,
    );
    expect(svg).toContain("stop-color='rgba(255, 0, 0, 1)'");
    expect(svg).toContain("stop-color='rgba(0, 0, 255, 1)'");
  });

  test("switching a view to gradient with no explicit gradient paints the default gradient", () => {
    const { doc, viewId } = makeDesignerDoc();
    const target: StyleTarget = { nodeId: viewId, nodeType: "view" };

    // The real panel flow: enable fill, then just switch the type — the
    // gradient comes from the schema default (white -> transparent).
    apply(doc, target, { backgroundEnabled: true });
    apply(doc, target, { backgroundType: "gradient" });

    const rendered = buildViewStyles(effectiveStyle(doc, viewId) as never);
    expect(rendered.backgroundColor).toBeUndefined();
    expect(String(rendered.backgroundImage)).toContain(GRADIENT_URL_PREFIX);
  });

  test("switching the screen to gradient paints an SVG data-URI backgroundImage", () => {
    const { doc, screenId } = makeDesignerDoc();
    const target: StyleTarget = { nodeId: screenId, nodeType: "screen" };

    // The seeded screen is already backgroundEnabled with a solid white fill;
    // the user just switches the type to gradient.
    apply(doc, target, { backgroundType: "gradient" });

    const rendered = buildScreenContainerStyles(effectiveStyle(doc, screenId) as never);
    expect(rendered.backgroundColor).toBeUndefined();
    expect(String(rendered.backgroundImage)).toContain(GRADIENT_URL_PREFIX);
  });

  test("an image view paints a url() backgroundImage with the mapped size", () => {
    const { doc, viewId } = makeDesignerDoc();
    const target: StyleTarget = { nodeId: viewId, nodeType: "view" };

    apply(doc, target, { backgroundEnabled: true, backgroundType: "image" });
    apply(doc, target, {
      backgroundImage: { url: "https://example.com/bg.png", resizeMode: "contain" },
    });

    const rendered = buildViewStyles(effectiveStyle(doc, viewId) as never);
    expect(rendered.backgroundColor).toBeUndefined();
    expect(rendered.backgroundImage).toBe('url("https://example.com/bg.png")');
    expect(rendered.backgroundSize).toBe("contain");
  });

  test("a solid view still paints backgroundColor", () => {
    const { doc, viewId } = makeDesignerDoc();
    const target: StyleTarget = { nodeId: viewId, nodeType: "view" };

    apply(doc, target, {
      backgroundEnabled: true,
      backgroundType: "solid",
      backgroundColor: "rgba(10, 20, 30, 1)",
    });

    const rendered = buildViewStyles(effectiveStyle(doc, viewId) as never);
    expect(rendered.backgroundImage).toBeUndefined();
    expect(rendered.backgroundColor).toBe("rgba(10, 20, 30, 1)");
  });
});
