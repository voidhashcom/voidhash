# @voidhash/paywall-style-engine

Validation, normalization, capability derivation, and CSS lowering for paywall node styles. The engine is the single owner of style semantics: it sits in front of the mimic document, so editors, the AI edit path, and the renderers all agree on what a style means.

The package contains no UI runtime and holds no state. Callers project their document into plain views and receive plain patches, diagnostics, and CSS back.

```typescript
import {
  compileBoxStyles,
  deriveAxisSizing,
  nodeCapabilities,
  normalizeStylePatch,
  planStyleEdit,
  validateStylePatch,
} from "@voidhash/paywall-style-engine";
```

## Layers

- **Introspection** — the legal style vocabulary per node type, derived from the live mimic primitives rather than hand-listed, so the engine cannot drift from what the document can persist.
- **Model** — a sentinel-free view of sizing: `deriveAxisSizing` resolves fill/hug/fixed from a node's style and its parent's flex context; `sizingModePatch` writes the CSS-correct `alignSelf`/`flex` pairing back.
- **Validation & normalization** — unknown fields and wrong-typed values become synchronous, field-pathed diagnostics instead of silent strips or late transaction rejections; patches are clamped, `*Enabled` group flags derived, CRDT array envelopes unwrapped, and conflicting flex sizing repaired per node.
- **Capabilities** — what a selection can express right now, with machine-readable reasons, so editors disable controls with an explanation instead of hiding them.
- **Virtual stretch** — the CSS identity between a container's `alignItems: "stretch"` and `alignSelf: "stretch"` on every child, in both directions, so the editing surface can drop stretch as a state while the persisted document stays literal CSS.
- **Planner** — semantic edit operations (`setSizingMode`, `setSize`, `setPositioning`, `setStyle`) resolved into per-node write plans, including which write discipline the document layer requires.
- **Compiler** — the single lowering from persisted style to CSS, shared by the deployed runtime and the designer canvas so they cannot diverge.
