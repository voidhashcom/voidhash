/**
 * HTML document template for self-contained paywall output.
 */

export interface DocumentTemplateOptions {
  /** The pre-rendered HTML body content */
  body: string;
  /**
   * The JSON-serialized hydration payload: a bare snapshot, or
   * `{ snapshot, componentArtifacts }` when component preview trees are
   * embedded.
   */
  payloadJson: string;
  /** The runtime script for hydration (if enabled) */
  runtimeScript?: string;
  /** Metadata to embed as HTML comment */
  metadata?: PaywallMetadata;
}

export interface PaywallMetadata {
  createdAt: string;
  schemaVersion: number;
  version: number;
  status: string;
}

/**
 * Generates a complete HTML document with the paywall content.
 */
export function generateDocument(options: DocumentTemplateOptions): string {
  const { body, payloadJson, runtimeScript, metadata } = options;

  const metadataComment = metadata
    ? `<!--
VOIDHASH_PAYWALL_METADATA
${JSON.stringify(metadata)}
END_VOIDHASH_PAYWALL_METADATA
-->\n`
    : "";

  const scriptSection = runtimeScript
    ? `
  <script id="__PAYWALL_DATA__" type="application/json">${payloadJson}</script>
  <script>${runtimeScript}</script>`
    : "";

  return `<!DOCTYPE html>
${metadataComment}<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; width: 100%; overflow: hidden; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="paywall-root">${body}</div>${scriptSection}
</body>
</html>`;
}
