import { renderPaywallToHtml } from "@voidhash/paywall-renderer-preact";
import { describe, expect, test } from "vite-plus/test";

import {
  applyStyleUpdate,
  type StyleTarget,
} from "../state/actions/features/style-action-helpers";
import {
  createOfflineDesignerDocument,
  seededIds,
  type OfflineDesignerDocument,
} from "../state/testing/offline-document";
import { selectDocumentRoot, selectRenderRoot } from "../state/utils/document-root";

// The preview iframe renders `renderPaywallToHtml(<snapshot>, ...)`. These tests
// pin the snapshot source the preview must read so a gradient edit reaches the
// phone frame — the staleness bug was rendering a frozen `selectDocumentRoot`
// capture instead of the live, draft-aware `selectRenderRoot` the canvas uses.

const GRADIENT = {
  kind: "linear" as const,
  startX: 0,
  startY: 0,
  endX: 1,
  endY: 1,
  stops: [
    { color: "rgba(255, 0, 0, 1)", position: 0 },
    { color: "rgba(0, 0, 255, 1)", position: 1 },
  ],
};

function makeDesignerDoc() {
  const doc = createOfflineDesignerDocument();
  const { screenId } = seededIds(doc);
  let viewId = "";
  doc.transaction((root) => {
    const screen = root.findByIdAcrossTree(screenId);
    if (!screen) throw new Error("expected the seeded screen node");
    viewId = screen.children.insertLast({ type: "view", name: "Card" }).id;
  });
  return { doc, viewId };
}

function mimicOf(doc: OfflineDesignerDocument) {
  return { document: doc, snapshot: doc.getSnapshot() } as never;
}

/** Store-state shape the preview reads its render root from. */
function stateOf(doc: OfflineDesignerDocument) {
  return { mimic: { snapshot: doc.getSnapshot() } } as never;
}

function paintGradient(doc: OfflineDesignerDocument, viewId: string): void {
  const nodes: StyleTarget[] = [{ nodeId: viewId, nodeType: "view" }];
  applyStyleUpdate(
    mimicOf(doc),
    nodes,
    { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: GRADIENT },
    {},
    ((fn: never) => doc.transaction(fn)) as never,
  );
}

describe("preview snapshot reflects gradient edits", () => {
  test("committed gradient reaches renderPaywallToHtml via the preview's render root", () => {
    const { doc, viewId } = makeDesignerDoc();

    // A snapshot captured once on preview entry (the old one-shot behaviour).
    const frozenCapture = selectDocumentRoot(stateOf(doc));

    paintGradient(doc, viewId);

    // Fail-before: the frozen capture never sees the later edit, so the phone
    // frame would keep rendering the pre-edit solid background.
    const frozen = renderPaywallToHtml(frozenCapture, { hydrate: true }).html;
    expect(frozen).not.toContain('"backgroundType":"gradient"');

    // Pass-after: the preview reads the live render root each render, so the
    // committed gradient edit now appears without re-entering preview mode.
    const live = renderPaywallToHtml(selectRenderRoot(stateOf(doc)), { hydrate: true }).html;
    expect(live).toContain("data:image/svg+xml,");
    expect(live).toContain('"backgroundType":"gradient"');
  });

  test("selectRenderRoot surfaces an in-progress draft gradient that selectDocumentRoot misses", () => {
    const { doc, viewId } = makeDesignerDoc();

    // A style-panel drag stages its writes in a mimic draft; the committed
    // document (and therefore selectDocumentRoot) stays on the pre-edit value.
    const draft = doc.createDraft();
    const nodes: StyleTarget[] = [{ nodeId: viewId, nodeType: "view" }];
    applyStyleUpdate(
      { document: doc, snapshot: draft.getSnapshot() } as never,
      nodes,
      { backgroundEnabled: true, backgroundType: "gradient", backgroundGradient: GRADIENT },
      {},
      ((fn: never) => draft.transaction(fn)) as never,
    );

    const state = {
      mimic: { snapshot: doc.getSnapshot() },
      _commander: { activeDraft: draft },
    } as never;

    // The old preview path (selectDocumentRoot, committed doc) would render the
    // pre-edit solid background; the canvas/preview render root shows the draft.
    const committed = renderPaywallToHtml(selectDocumentRoot(state), { hydrate: true }).html;
    expect(committed).not.toContain('"backgroundType":"gradient"');

    const rendered = renderPaywallToHtml(selectRenderRoot(state), { hydrate: true }).html;
    expect(rendered).toContain('"backgroundType":"gradient"');

    draft.discard();
  });
});
