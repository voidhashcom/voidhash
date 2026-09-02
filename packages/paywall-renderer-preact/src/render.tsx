import type { RenderResult, SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { createElement } from "preact";
import render from "preact-render-to-string";

import type { ComponentArtifacts } from "./component-artifacts";
import { Paywall } from "./components/paywall";
import { generateDocument, type PaywallMetadata } from "./templates/document-template";
import { generateRuntimeScript } from "./templates/runtime-script";
import * as Schema from "effect/Schema";
const effectEncodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

/**
 * Options for body-only paywall rendering.
 */
export interface RenderPaywallOptions {
  /** Preview trees for the snapshot's component nodes (missing → placeholder). */
  componentArtifacts?: ComponentArtifacts;
  /**
   * Locale to resolve localized content against. Omitted (or the document's
   * default locale) renders the base props — byte-for-byte the unlocalized
   * output.
   */
  locale?: string;
}

export function renderPaywall(
  snapshot: SnapshotNode,
  options: RenderPaywallOptions = {},
): RenderResult {
  const body = render(
    createElement(Paywall, {
      componentArtifacts: options.componentArtifacts,
      locale: options.locale,
      snapshot,
    }),
  );
  const html = wrapInDocument(body);
  return { html };
}

function wrapInDocument(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * Options for HTML rendering with hydration support.
 */
export interface HtmlRenderOptions {
  /** Include hydration script (default: true) */
  hydrate?: boolean;
  /** Include metadata comments (default: false) */
  debug?: boolean;
  /** Metadata to embed in the document */
  metadata?: PaywallMetadata;
  /** Preview trees for the snapshot's component nodes (missing → placeholder) */
  componentArtifacts?: ComponentArtifacts;
  /**
   * Locale to resolve localized content against, threaded into the SSR render
   * AND embedded in the hydration payload so the client re-render matches.
   * Omitted (or the default locale) renders the base props unchanged.
   */
  locale?: string;
}

/**
 * Result of HTML rendering.
 */
export interface HtmlRenderResult {
  /** The complete HTML document */
  html: string;
  /** Size in bytes */
  size: number;
}

/**
 * Renders a paywall snapshot to a self-contained HTML document.
 *
 * This generates a complete HTML file that:
 * - Contains pre-rendered HTML from SSR
 * - Includes the htm/preact runtime for client-side hydration
 * - Embeds the snapshot data (and component preview trees, when provided)
 *   for re-rendering
 * - Has no external dependencies
 *
 * `<` is escaped as `\u003c` in the embedded payload JSON so payload strings
 * (e.g. preview-tree text) cannot close the `<script>` block.
 *
 * @param snapshot - The paywall snapshot to render
 * @param options - Rendering options
 * @returns The complete HTML document and its size
 */
export function renderPaywallToHtml(
  snapshot: SnapshotNode,
  options: HtmlRenderOptions = {},
): HtmlRenderResult {
  const { hydrate = true, metadata, componentArtifacts, locale } = options;

  // Server-render the paywall to HTML
  const body = render(createElement(Paywall, { componentArtifacts, locale, snapshot }));

  // Serialize the hydration payload. Bare snapshots stay the wire shape when
  // there are no component artifacts so older payload consumers keep working;
  // the hydration runtime detects both shapes. `<` only occurs inside JSON
  // strings, where `\u003c` is an equivalent escape — JSON.parse round-trips
  // it losslessly while keeping `</script>` out of the embedded block.
  const useWrapper = componentArtifacts !== undefined || locale !== undefined;
  const payloadJson = effectEncodeJson(
    useWrapper ? { componentArtifacts, locale, snapshot } : snapshot,
  ).replace(/</g, "\\u003c");

  // Generate the runtime script if hydration is enabled
  const runtimeScript = hydrate ? generateRuntimeScript() : undefined;

  // Generate the complete document
  const html = generateDocument({
    body,
    metadata,
    payloadJson,
    runtimeScript,
  });

  return {
    html,
    size: new TextEncoder().encode(html).byteLength,
  };
}
