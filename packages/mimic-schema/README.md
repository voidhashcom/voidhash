# @voidhash/mimic-schema

The shared document schema for the Voidhash paywall designer and renderers.

It defines the Mimic primitives for document nodes, styles, variables, states, interactions, localization, component bindings, presence, and document reconciliation.

## Usage

```typescript
import {
  PaywallDesignerDocument,
  ScreenNode,
  TextNode,
  reconcile,
} from "@voidhash/mimic-schema";
```

The package is runtime-agnostic and depends only on `@voidhash/mimic-core`.
