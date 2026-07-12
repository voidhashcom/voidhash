# @voidhash/paywall-renderer-web-core

Platform-neutral snapshot evaluation, action resolution, variable handling, preview-tree contracts, and CSS style builders shared by Voidhash paywall renderers.

The package contains no UI runtime. Renderer packages consume its typed snapshot model and deterministic helpers to produce platform-specific output.

```typescript
import {
  buildTextStyles,
  resolveStyle,
  type SnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
```
