import type {
  RenderOptions,
  RenderResult,
  SnapshotNode
} from '@voidhash/paywall-renderer-web-core';
import render from 'preact-render-to-string';
import { Paywall } from './components/paywall';

export function renderPaywall(
  snapshot: SnapshotNode,
  _options: RenderOptions = {}
): RenderResult {
  const body = render(<Paywall snapshot={snapshot} />);
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
