# Designer File Format (DFF)

This package provides the single source of truth for the Voidhash Designer file format.

## What is DFF?

DFF (Designer File Format) is the file specification for storing and sharing designer files in Voidhash. It provides:

- **Effect Schema definitions** for all node types (Screen, Text, Column, Row, Root)
- **Type-safe Yjs operations** via `DesignDocument` class
- **Validation** ensuring data integrity before persisting to Yjs
- **Synchronous API** for use in voidsync actions

## Usage

### Types

```typescript
import type {
  NodeData,
  ScreenNodeData,
  TextNodeData,
  FlexNodeData,
  RootNodeData,
} from "@voidhash/dff";
```

### Synchronous API (for voidsync actions)

```typescript
import {
  setScreenNodeSync,
  setTextNodeSync,
  updateTextNodeSync,
  setRootNodeSync,
} from "@voidhash/dff";

// Create root node
const nodesMap = doc.getMap("nodes");
setRootNodeSync(nodesMap, "root");

// Create a screen
setScreenNodeSync(nodesMap, {
  type: "screen",
  id: "screen-1",
  name: "Main Screen",
  parent: { id: "root", index: "a0" },
  x: 0,
  y: 0,
  width: 375,
  height: 812,
  backgroundColor: "#ffffff",
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  safeArea: { top: false, bottom: false },
});

// Update a text node
updateTextNodeSync(nodesMap, "text-1", {
  text: "Updated text",
  fontSize: 18,
});
```

### DesignDocument Class (Effect-based API)

```typescript
import { Effect } from "effect";
import { DesignDocument } from "@voidhash/dff";
import * as Y from "yjs";

const doc = new Y.Doc();
const designDoc = new DesignDocument(doc);

// Create root node
Effect.runSync(designDoc.createRootNode());

// Add a screen
Effect.runSync(
  designDoc.setNode({
    type: "screen",
    id: "screen-1",
    name: "Main Screen",
    // ...
  })
);

// Get a node (with validation)
const node = Effect.runSync(designDoc.getNode("screen-1"));
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                      │
│                  useDesignerSelect()                     │
└─────────────────────────────┬───────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│                      Voidsync                            │
│  - Zustand store with awareness + browser + synced      │
│  - Syncs Y.Doc changes to React state                   │
└─────────────────────────────┬───────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│                   @voidhash/dff                          │
│  - Effect Schema definitions (single source of truth)   │
│  - toYjs() / fromYjs() conversions                      │
│  - Typed mutation operations                            │
└─────────────────────────────┬───────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│                       Y.Doc                              │
│               (Persisted document)                       │
└─────────────────────────────────────────────────────────┘
```
