"use client";

import { renderPaywallToHtml } from "@voidhash/paywall-renderer-preact";
import type { RootSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useMemo } from "react";

import { localeLabel } from "../utils/locale-display";

interface ContextPreviewProps {
  root: RootSnapshotNode;
  /** The screen to render, or null when nothing is selectable. */
  screenId: string | null;
  /** The selected row's node, outlined and scrolled into view. */
  highlightNodeId: string | null;
  locale: string | null;
}

const FRAME_WIDTH = 264;
const DESIGN_WIDTH = 375;
const DESIGN_HEIGHT = 812;

/** Restricts a node id to characters safe inside the injected selector/script. */
function safeNodeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_:.-]/g, "");
}

/**
 * Appends a highlight style + scroll-into-view script for the selected node.
 * With `hydrate: false` this is the document's only script; the iframe stays
 * sandboxed (`allow-scripts`, opaque origin, no parent access needed).
 */
function withHighlight(html: string, nodeId: string | null): string {
  if (nodeId === null) {
    return html;
  }
  const id = safeNodeId(nodeId);
  if (id === "") {
    return html;
  }
  const selector = `[data-node-id="${id}"]`;
  const injection =
    // blue-ribbon-600 as a literal: this style is injected into the preview
    // document, which does not inherit the studio's custom properties.
    `<style>${selector}{outline:2px solid #0673ff;outline-offset:2px;border-radius:2px;}</style>` +
    `<script>document.querySelector('${selector}')` +
    `?.scrollIntoView({block:"center",inline:"center"});</script>`;
  return html.includes("</body>")
    ? html.replace("</body>", `${injection}</body>`)
    : html + injection;
}

/**
 * Translation mode's right rail: a read-only render of the selected row's
 * screen in the target locale, via `renderPaywallToHtml` (`hydrate: false`)
 * into a sandboxed iframe. The snapshot is reduced to the containing screen;
 * text resolves per locale in v1 (images/props follow in a later renderer
 * phase). Component artifacts are not threaded here — component nodes render
 * the renderer's labeled placeholder.
 */
export function ContextPreview({ root, screenId, highlightNodeId, locale }: ContextPreviewProps) {
  const html = useMemo(() => {
    if (screenId === null || locale === null) {
      return null;
    }
    const screen = root.children.find((child) => child.id === screenId);
    if (screen === undefined) {
      return null;
    }
    const reduced = { ...root, children: [screen] };
    const rendered = renderPaywallToHtml(reduced, { hydrate: false, locale });
    return withHighlight(rendered.html, highlightNodeId);
  }, [root, screenId, highlightNodeId, locale]);

  const scale = FRAME_WIDTH / DESIGN_WIDTH;

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium text-muted-foreground text-xs">Preview</span>
        {locale !== null && (
          <span className="text-muted-foreground text-xs">{localeLabel(locale)}</span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden p-4 pt-2">
        {html === null ? (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground text-sm">
            Select a row to preview its screen.
          </div>
        ) : (
          <div
            className="relative shrink-0 overflow-hidden rounded-[24px] border-4 border-zinc-800 bg-zinc-800 shadow-lg"
            style={{ height: DESIGN_HEIGHT * scale + 8, width: FRAME_WIDTH + 8 }}
          >
            <iframe
              className="origin-top-left bg-white"
              sandbox="allow-scripts"
              srcDoc={html}
              style={{
                height: DESIGN_HEIGHT,
                transform: `scale(${scale})`,
                width: DESIGN_WIDTH,
              }}
              title="Translation preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
