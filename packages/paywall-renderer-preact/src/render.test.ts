import { ScreenNode, ViewNode } from "@voidhash/mimic-schema";
import type { PreviewTree, SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import type { ComponentArtifacts } from "./component-artifacts";
import { renderPaywall, renderPaywallToHtml } from "./render";

// Encode/decode round-trips through the real mimic node data structs
// materialize schema defaults and the CRDT stop envelope (`{ id, pos, value }`),
// so fixtures carry the EXACT snapshot shape `selectDocumentRoot` hands the
// device preview — this drives the true preview-canvas path, not a hand-built
// approximation of it.
function makeViewStyle(style?: Parameters<typeof ViewNode.data.encode>[0]["style"]) {
  return ViewNode.data.decode(ViewNode.data.encode({ style })).style;
}

function makeScreenStyle(style?: Parameters<typeof ScreenNode.data.encode>[0]["style"]) {
  return ScreenNode.data.decode(ScreenNode.data.encode({ style })).style;
}

function makeScreenNode(id: string, style: unknown, children: SnapshotNode[] = []): SnapshotNode {
  return {
    type: "screen",
    id,
    parentId: null,
    pos: "a0",
    data: {
      name: "Screen",
      style,
      states: [],
      localVariables: [],
      linkedVariables: [],
    },
    children,
  } as unknown as SnapshotNode;
}

function makeRootNode(children: SnapshotNode[]): SnapshotNode {
  return {
    type: "root",
    id: "root",
    parentId: null,
    pos: "a0",
    data: { name: "Paywall" },
    children,
  } as unknown as SnapshotNode;
}

function makeTextNode(id: string, text: string): SnapshotNode {
  return {
    type: "text",
    id,
    parentId: null,
    pos: "a0",
    data: {
      name: "Text",
      text,
      style: {},
      states: [],
      localVariables: [],
      linkedVariables: [],
    },
    children: [],
  } as unknown as SnapshotNode;
}

function makeComponentNode(
  id: string,
  contentHash: string,
  children: SnapshotNode[] = [],
  previewState = "default",
): SnapshotNode {
  return {
    type: "component",
    id,
    parentId: null,
    pos: "a0",
    data: {
      name: "Component",
      componentSlug: "hero-card",
      componentVersion: 1,
      contentHash,
      previewState,
      props: [],
      actionBindings: [],
    },
    children,
  } as unknown as SnapshotNode;
}

function makeLocalComponentNode(
  id: string,
  componentPath: string,
  children: SnapshotNode[] = [],
  previewState = "default",
): SnapshotNode {
  return {
    type: "component",
    id,
    parentId: null,
    pos: "a0",
    data: {
      name: "Component",
      componentSource: "local",
      componentPath,
      componentSlug: "",
      componentVersion: 0,
      contentHash: "",
      previewState,
      props: [],
      actionBindings: [],
    },
    children,
  } as unknown as SnapshotNode;
}

function makeViewNode(
  id: string,
  style: Record<string, unknown>,
  children: SnapshotNode[] = [],
): SnapshotNode {
  return {
    type: "view",
    id,
    parentId: null,
    pos: "a0",
    data: {
      name: "View",
      style,
      states: [],
      interactions: [],
      localVariables: [],
      linkedVariables: [],
    },
    children,
  } as unknown as SnapshotNode;
}

function artifactsWithTree(contentHash: string, state: string, root: PreviewTree["root"]) {
  const tree: PreviewTree = { treeVersion: 1, state, root };
  return { trees: { [contentHash]: { [state]: tree } } } satisfies ComponentArtifacts;
}

function artifactsWithLocalTree(
  componentPath: string,
  state: string,
  root: PreviewTree["root"],
) {
  const tree: PreviewTree = { treeVersion: 1, state, root };
  return {
    trees: {},
    localTrees: { [componentPath]: { [state]: tree } },
  } satisfies ComponentArtifacts;
}

describe("renderPaywall nested node data", () => {
  test('renders view "auto" dimensions as CSS auto and omits absent constraints', () => {
    const snapshot = makeRootNode([makeViewNode("view-1", { width: "auto", height: 120 })]);

    const { html } = renderPaywall(snapshot);

    expect(html).toContain('data-node-id="view-1"');
    expect(html).toContain("width:auto");
    expect(html).toContain("height:120px");
    expect(html).not.toContain("min-width");
    expect(html).not.toContain("max-width");
  });

  test("renders explicit flex and min/max constraints from node.data.style", () => {
    const snapshot = makeRootNode([
      makeViewNode("view-1", { flex: 1, minWidth: 10, width: 100, height: "auto" }),
    ]);

    const { html } = renderPaywall(snapshot);

    expect(html).toContain("flex:1");
    expect(html).toContain("min-width:10px");
    expect(html).toContain("width:100px");
    expect(html).toContain("height:auto");
  });

  test("renders an absolute-positioned text node with its offsets from node.data.style", () => {
    const textNode = {
      type: "text",
      id: "text-1",
      parentId: null,
      pos: "a0",
      data: {
        name: "Text",
        text: "Badge",
        style: { position: "absolute", top: 10, left: 20 },
        states: [],
        localVariables: [],
        linkedVariables: [],
      },
      children: [],
    } as unknown as SnapshotNode;
    const snapshot = makeRootNode([textNode]);

    const { html } = renderPaywall(snapshot);

    // The text element renders on the flow node directly (no wrapper), so the
    // absolute position + numeric offsets land as CSS.
    expect(html).toContain('data-node-id="text-1"');
    expect(html).toContain("position:absolute");
    expect(html).toContain("top:10px");
    expect(html).toContain("left:20px");
  });
});

describe("renderPaywall device-preview backgrounds (real mimic snapshot)", () => {
  test("a gradient view background lowers to the SVG data-URI in the preview DOM", () => {
    const style = makeViewStyle({
      backgroundEnabled: true,
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "radial",
        startX: 0.5,
        startY: 0.5,
        endX: 1,
        endY: 1,
        stops: [
          { color: "rgba(0, 0, 255, 1)", position: 0 },
          { color: "rgba(255, 0, 0, 1)", position: 1 },
        ],
      },
    });
    const snapshot = makeRootNode([makeViewNode("view-1", style as Record<string, unknown>)]);

    const { html } = renderPaywall(snapshot);

    // The gradient is emitted as an inline SVG data-URI backgroundImage — NOT a
    // solid backgroundColor fallback. This is the exact byte-shape the designer
    // canvas produces (buildBackgroundStyles), reached here through the preact
    // View → buildViewStyles path the device preview actually runs.
    expect(html).toContain("data:image/svg+xml,");
    expect(html).toContain("radialGradient");
    expect(html).toContain("background-size:100% 100%");
  });

  test("an image view background lowers to url() with the mapped background-size", () => {
    const style = makeViewStyle({
      backgroundEnabled: true,
      backgroundType: "image",
      backgroundImage: { url: "https://example.com/bg.png", resizeMode: "contain" },
    });
    const snapshot = makeRootNode([makeViewNode("view-1", style as Record<string, unknown>)]);

    const { html } = renderPaywall(snapshot);

    expect(html).toContain('url(&quot;https://example.com/bg.png&quot;)');
    expect(html).toContain("background-size:contain");
  });

  test("a gradient screen background reaches the screen container in the preview DOM", () => {
    const style = makeScreenStyle({
      backgroundEnabled: true,
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0.5,
        startY: 0,
        endX: 0.5,
        endY: 1,
        stops: [
          { color: "rgba(20, 20, 20, 1)", position: 0 },
          { color: "rgba(0, 0, 0, 1)", position: 1 },
        ],
      },
    });
    const snapshot = makeRootNode([makeScreenNode("screen-1", style)]);

    const { html } = renderPaywall(snapshot);

    expect(html).toContain('data-node-id="screen-1"');
    expect(html).toContain("data:image/svg+xml,");
    expect(html).toContain("linearGradient");
  });

  test("renderPaywallToHtml embeds and re-renders the gradient through the hydration payload", () => {
    const style = makeViewStyle({
      backgroundEnabled: true,
      backgroundType: "gradient",
      backgroundGradient: {
        kind: "linear",
        startX: 0,
        startY: 0,
        endX: 1,
        endY: 1,
        stops: [
          { color: "rgba(255, 255, 255, 1)", position: 0 },
          { color: "rgba(0, 0, 0, 1)", position: 1 },
        ],
      },
    });
    const snapshot = makeRootNode([makeViewNode("view-1", style as Record<string, unknown>)]);

    const { html } = renderPaywallToHtml(snapshot, { hydrate: true });

    // SSR body carries the gradient, and the embedded snapshot payload retains
    // the CRDT stop envelope so client hydration re-derives the same data-URI.
    expect(html).toContain("data:image/svg+xml,");
    expect(html).toContain('"backgroundType":"gradient"');
    expect(html).toContain('"value":{"color":"rgba(255, 255, 255, 1)","position":0}');
  });

  test("a disabled background stays transparent (no gradient leak)", () => {
    const style = makeViewStyle({
      backgroundEnabled: false,
      backgroundType: "gradient",
    });
    const snapshot = makeRootNode([makeViewNode("view-1", style as Record<string, unknown>)]);

    const { html } = renderPaywall(snapshot);

    expect(html).not.toContain("data:image/svg+xml,");
    expect(html).toContain("background-color:transparent");
  });
});

describe("renderPaywall with component nodes", () => {
  test("renders a component node statically from its provided preview tree", () => {
    const snapshot = makeRootNode([makeComponentNode("component-1", "hash-1")]);
    const componentArtifacts = artifactsWithTree("hash-1", "default", {
      type: "view",
      style: { paddingTop: 8 },
      children: [{ type: "text", style: { fontSize: 14 }, text: "Hello from component" }],
    });

    const { html } = renderPaywall(snapshot, { componentArtifacts });

    expect(html).toContain("Hello from component");
    expect(html).toContain('data-node-id="component-1"');
  });

  test("falls back to the default tree, then the first available state", () => {
    const snapshot = makeRootNode([
      makeComponentNode("component-1", "hash-1", [], "missing-state"),
    ]);
    const viaDefault = renderPaywall(snapshot, {
      componentArtifacts: artifactsWithTree("hash-1", "default", {
        type: "text",
        style: {},
        text: "Default state",
      }),
    });
    expect(viaDefault.html).toContain("Default state");

    const viaFirstAvailable = renderPaywall(snapshot, {
      componentArtifacts: artifactsWithTree("hash-1", "compact", {
        type: "text",
        style: {},
        text: "Compact state",
      }),
    });
    expect(viaFirstAvailable.html).toContain("Compact state");
  });

  test("mounts the node's children at the tree's slot marker", () => {
    const snapshot = makeRootNode([
      makeComponentNode("component-1", "hash-1", [makeTextNode("text-1", "Slotted child")]),
    ]);
    const componentArtifacts = artifactsWithTree("hash-1", "default", {
      type: "view",
      style: {},
      children: [{ type: "slot" }],
    });

    const { html } = renderPaywall(snapshot, { componentArtifacts });

    expect(html).toContain("Slotted child");
    expect(html).toContain('data-node-id="text-1"');
  });

  test("does not render children when the tree has no slot marker", () => {
    const snapshot = makeRootNode([
      makeComponentNode("component-1", "hash-1", [makeTextNode("text-1", "Slotted child")]),
    ]);
    const componentArtifacts = artifactsWithTree("hash-1", "default", {
      type: "view",
      style: {},
      children: [],
    });

    const { html } = renderPaywall(snapshot, { componentArtifacts });

    expect(html).not.toContain("Slotted child");
  });

  test("renders a labeled placeholder when no tree exists for the contentHash", () => {
    const snapshot = makeRootNode([makeComponentNode("component-1", "hash-1")]);

    const withoutArtifacts = renderPaywall(snapshot);
    expect(withoutArtifacts.html).toContain("Component &quot;hero-card&quot; preview unavailable");

    const withOtherArtifacts = renderPaywall(snapshot, {
      componentArtifacts: artifactsWithTree("other-hash", "default", {
        type: "text",
        style: {},
        text: "Other",
      }),
    });
    expect(withOtherArtifacts.html).toContain(
      "Component &quot;hero-card&quot; preview unavailable",
    );
  });

  test("resolves a local component by componentPath (contentHash is a sentinel)", () => {
    const snapshot = makeRootNode([
      makeLocalComponentNode("component-1", "components/def-1.tsx", [
        makeTextNode("text-1", "Slotted child"),
      ]),
    ]);
    const componentArtifacts = artifactsWithLocalTree("components/def-1.tsx", "default", {
      type: "view",
      style: {},
      children: [{ type: "slot" }],
    });

    const { html } = renderPaywall(snapshot, { componentArtifacts });

    expect(html).toContain("Slotted child");
    expect(html).toContain('data-node-id="text-1"');
    expect(html).not.toContain("preview unavailable");
  });

  test("renders a labeled placeholder when no local tree exists for the componentPath", () => {
    const snapshot = makeRootNode([makeLocalComponentNode("component-1", "components/def-1.tsx")]);

    // A catalog tree matching the sentinel empty contentHash must not be picked
    // up by a local node — it resolves solely via localTrees/componentPath.
    const withCatalogOnly = renderPaywall(snapshot, {
      componentArtifacts: artifactsWithTree("", "default", { type: "text", style: {}, text: "X" }),
    });
    expect(withCatalogOnly.html).toContain(
      "Component &quot;components/def-1.tsx&quot; preview unavailable",
    );

    const withOtherLocal = renderPaywall(snapshot, {
      componentArtifacts: artifactsWithLocalTree("components/other-def.tsx", "default", {
        type: "text",
        style: {},
        text: "Other",
      }),
    });
    expect(withOtherLocal.html).toContain(
      "Component &quot;components/def-1.tsx&quot; preview unavailable",
    );
  });

  test("renders a labeled placeholder instead of throwing on unknown node types", () => {
    const snapshot = makeRootNode([
      { type: "carousel", id: "future-1", children: [] } as unknown as SnapshotNode,
    ]);

    const { html } = renderPaywall(snapshot);

    expect(html).toContain("Unsupported node type: carousel");
  });
});

describe("renderPaywallToHtml payload embedding", () => {
  test("embeds the bare snapshot when no component artifacts are provided", () => {
    const { html } = renderPaywallToHtml(makeRootNode([]));

    expect(html).toContain('<script id="__PAYWALL_DATA__" type="application/json">{"type":"root"');
    expect(html).not.toContain('"componentArtifacts"');
  });

  test("wraps snapshot and componentArtifacts when artifacts are provided", () => {
    const { html } = renderPaywallToHtml(makeRootNode([makeComponentNode("c-1", "hash-1")]), {
      componentArtifacts: artifactsWithTree("hash-1", "default", {
        type: "text",
        style: {},
        text: "Embedded",
      }),
    });

    expect(html).toContain('"componentArtifacts":{"trees":');
    expect(html).toContain('"snapshot":{"type":"root"');
  });

  test("escapes < in the payload so tree text cannot break out of the script block", () => {
    const malicious = "</script><script>window.breakout = true</script>";
    const { html } = renderPaywallToHtml(makeRootNode([makeComponentNode("c-1", "hash-1")]), {
      componentArtifacts: artifactsWithTree("hash-1", "default", {
        type: "text",
        style: {},
        text: malicious,
      }),
    });

    const open = '<script id="__PAYWALL_DATA__" type="application/json">';
    const start = html.indexOf(open) + open.length;
    const payload = html.slice(start, html.indexOf("</script>", start));
    expect(payload).not.toContain("<");
    const parsed = JSON.parse(payload) as { componentArtifacts: ComponentArtifacts };
    expect(parsed.componentArtifacts.trees["hash-1"]?.default?.root).toMatchObject({
      text: malicious,
    });
  });
});

describe("hydration runtime bundle", () => {
  // The snapshot carries no gradients, so these markers can only come from the
  // embedded hydration runtime. SSR-only assertions once let a stale runtime
  // paint outdated styles over correct server output — this greps the runtime
  // itself so a bundle missing current style-builder logic fails here.
  test("embeds the current style builders in the runtime script", () => {
    const { html } = renderPaywallToHtml(makeRootNode([]));

    expect(html).toContain("backgroundGradient");
    expect(html).toContain("linearGradient");
    expect(html).toContain("radialGradient");
    expect(html).toContain("data:image/svg+xml");
  });

  test("omits the runtime script when hydration is disabled", () => {
    const { html } = renderPaywallToHtml(makeRootNode([]), { hydrate: false });

    expect(html).not.toContain("backgroundGradient");
  });

  // The global name can only come from the bundled `readInjectedConfig`, so a
  // runtime missing the SDK locale source (contract §7.1) fails here.
  test("embeds the SDK injected-config locale source in the runtime script", () => {
    const { html } = renderPaywallToHtml(makeRootNode([]));
    expect(html).toContain("__VOIDHASH_PAYWALL__");

    const withoutRuntime = renderPaywallToHtml(makeRootNode([]), { hydrate: false });
    expect(withoutRuntime.html).not.toContain("__VOIDHASH_PAYWALL__");
  });
});

// A root node carrying a localization config (defaultLocale) so the Text
// resolver can compute the base-vs-override fallback the same way the decoded
// document snapshot would.
function makeLocalizedRoot(children: SnapshotNode[], defaultLocale = "en"): SnapshotNode {
  return {
    type: "root",
    id: "root",
    parentId: null,
    pos: "a0",
    data: { name: "Paywall", localization: { defaultLocale, locales: [] } },
    children,
  } as unknown as SnapshotNode;
}

function makeLocalizedTextNode(
  id: string,
  text: string,
  localized: { locale: string; overrides: { text?: string } }[],
): SnapshotNode {
  return {
    type: "text",
    id,
    parentId: null,
    pos: "a0",
    data: { name: "Text", text, style: {}, states: [], localVariables: [], linkedVariables: [], localized },
    children: [],
  } as unknown as SnapshotNode;
}

describe("locale-aware text rendering", () => {
  const snapshot = makeLocalizedRoot([
    makeLocalizedTextNode("t-1", "Hello", [{ locale: "de", overrides: { text: "Hallo" } }]),
  ]);

  test("renders the base text when no locale is given", () => {
    expect(renderPaywall(snapshot).html).toContain("Hello");
    expect(renderPaywall(snapshot).html).not.toContain("Hallo");
  });

  test("renders the localized override for the active locale", () => {
    const { html } = renderPaywall(snapshot, { locale: "de" });
    expect(html).toContain("Hallo");
    expect(html).not.toContain(">Hello<");
  });

  test("falls back to base for a locale with no override", () => {
    expect(renderPaywall(snapshot, { locale: "fr" }).html).toContain("Hello");
  });

  test("embeds the locale in the hydration payload and re-renders it", () => {
    const { html } = renderPaywallToHtml(snapshot, { locale: "de" });
    expect(html).toContain('"locale":"de"');
    expect(html).toContain('"snapshot":{"type":"root"');
    // The SSR body already shows the resolved translation.
    expect(html).toContain("Hallo");
  });
});

const BASE_IMAGE_URL = "https://example.com/base.png";
const DE_IMAGE_URL = "https://example.com/de.png";

// Encode/decode round-trips through the real node data structs, so `localized`
// entries carry the exact CRDT envelope (`{ id, pos, value }`) a decoded
// document snapshot hands the renderer.
function makeLocalizedImageViewNode(id: string): SnapshotNode {
  const data = ViewNode.data.decode(
    ViewNode.data.encode({
      style: {
        backgroundEnabled: true,
        backgroundType: "image",
        backgroundImage: { url: BASE_IMAGE_URL, resizeMode: "cover" },
      },
      localized: [
        {
          locale: "de",
          overrides: { backgroundImage: { url: DE_IMAGE_URL, resizeMode: "contain" } },
        },
      ],
    }),
  );
  return { type: "view", id, parentId: null, pos: "a0", data, children: [] } as unknown as SnapshotNode;
}

function makeLocalizedImageScreenNode(id: string): SnapshotNode {
  const data = ScreenNode.data.decode(
    ScreenNode.data.encode({
      style: {
        backgroundEnabled: true,
        backgroundType: "image",
        backgroundImage: { url: BASE_IMAGE_URL, resizeMode: "cover" },
      },
      localized: [
        {
          locale: "de",
          overrides: { backgroundImage: { url: DE_IMAGE_URL, resizeMode: "cover" } },
        },
      ],
    }),
  );
  return { type: "screen", id, parentId: null, pos: "a0", data, children: [] } as unknown as SnapshotNode;
}

function makeLocalizedPropComponentNode(id: string, contentHash: string): SnapshotNode {
  return {
    type: "component",
    id,
    parentId: null,
    pos: "a0",
    data: {
      name: "Component",
      componentSlug: "hero-card",
      componentVersion: 1,
      contentHash,
      previewState: "default",
      props: [
        {
          name: "title",
          value: { type: "literal", value: { key: "string", value: "Base title" } },
          localizedValues: [{ locale: "de", value: { key: "string", value: "Deutscher Titel" } }],
        },
      ],
      actionBindings: [],
    },
    children: [],
  } as unknown as SnapshotNode;
}

describe("locale-aware background images (real mimic snapshot)", () => {
  const snapshot = makeLocalizedRoot([makeLocalizedImageViewNode("view-1")]);

  test("renders the base image when no locale is given", () => {
    const { html } = renderPaywall(snapshot);
    expect(html).toContain(BASE_IMAGE_URL);
    expect(html).not.toContain(DE_IMAGE_URL);
  });

  test("substitutes the whole localized image (url + resizeMode) for the active locale", () => {
    const { html } = renderPaywall(snapshot, { locale: "de" });
    expect(html).toContain(DE_IMAGE_URL);
    expect(html).toContain("background-size:contain");
    expect(html).not.toContain(BASE_IMAGE_URL);
  });

  test("falls back to the base image for a locale with no override", () => {
    const { html } = renderPaywall(snapshot, { locale: "fr" });
    expect(html).toContain(BASE_IMAGE_URL);
    expect(html).not.toContain(DE_IMAGE_URL);
  });

  test("resolves a language-prefix match (de-AT → de) end-to-end", () => {
    const { html } = renderPaywall(snapshot, { locale: "de-AT" });
    expect(html).toContain(DE_IMAGE_URL);
    expect(html).not.toContain(BASE_IMAGE_URL);
  });

  test("substitutes the localized image on the screen container", () => {
    const screenSnapshot = makeLocalizedRoot([makeLocalizedImageScreenNode("screen-1")]);
    const { html } = renderPaywall(screenSnapshot, { locale: "de" });
    expect(html).toContain('data-node-id="screen-1"');
    expect(html).toContain(DE_IMAGE_URL);
    expect(html).not.toContain(BASE_IMAGE_URL);
  });
});

describe("published-artifact locale resolution (renderPaywallToHtml)", () => {
  const snapshot = makeLocalizedRoot([
    makeLocalizedTextNode("t-1", "Hello", [{ locale: "de", overrides: { text: "Hallo" } }]),
    makeLocalizedImageViewNode("view-1"),
    makeLocalizedPropComponentNode("component-1", "hash-1"),
  ]);

  test("a forced locale resolves text + image in the SSR body and rides the payload", () => {
    const { html } = renderPaywallToHtml(snapshot, { locale: "de" });

    expect(html).toContain("Hallo");
    expect(html).toContain(DE_IMAGE_URL);
    expect(html).toContain('"locale":"de"');
    // Preview trees are fixture-baked per contentHash+state, so localized PROP
    // values surface through the component runtime, not the static tree — the
    // payload must carry the `localizedValues` entries for it to resolve.
    expect(html).toContain('"localizedValues"');
    expect(html).toContain("Deutscher Titel");
  });

  test("the body-only render without a locale stays base content", () => {
    const { html } = renderPaywall(snapshot);
    expect(html).toContain("Hello");
    expect(html).toContain(BASE_IMAGE_URL);
    expect(html).not.toContain("Hallo");
    expect(html).not.toContain(DE_IMAGE_URL);
  });
});
