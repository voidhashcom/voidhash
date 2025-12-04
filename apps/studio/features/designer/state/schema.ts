import type { NodeData } from '@voidhash/dff';
import { Schema } from 'effect';
import { createVoidsyncSchema, syncMap } from './core/voidsync';

// ============================================================================
// Re-export types from @dff (single source of truth)
// ============================================================================

export type {
  FlexNodeData,
  NodeData,
  NodeDataWithoutRoot,
  RootNodeData,
  ScreenNodeData,
  TextNodeData
} from '@voidhash/dff';

// ============================================================================
// Effect Schemas for Action Parameters
// ============================================================================

export const AvailableToolsSchema = Schema.Literal(
  'cursor',
  'text',
  'rows',
  'columns',
  'scroll-view'
);

export type AvailableTool = Schema.Schema.Type<typeof AvailableToolsSchema>;

// ============================================================================
// Designer Schema (Voidsync)
// ============================================================================

const CursorSchema = Schema.NullOr(
  Schema.Struct({
    x: Schema.Number,
    y: Schema.Number
  })
);

const UserSchema = Schema.Struct({
  name: Schema.String,
  color: Schema.String
});

const AwarenessSchema = Schema.Struct({
  cursor: CursorSchema,
  user: UserSchema,
  selectedNodeIds: Schema.Array(Schema.String)
});

const BoundingBoxSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number
});

const BrowserSchema = Schema.Struct({
  debug: Schema.Struct({
    showGrid: Schema.Boolean
  }),
  highlightedNodeId: Schema.NullOr(Schema.String),
  tools: Schema.Struct({
    activeTool: AvailableToolsSchema
  }),
  canvas: Schema.Struct({
    scale: Schema.Number,
    x: Schema.Number,
    y: Schema.Number,
    boundingBoxes: Schema.Record({
      key: Schema.String,
      value: BoundingBoxSchema
    })
  }),
  viewport: Schema.Struct({
    panels: Schema.Struct({
      top: Schema.Struct({ height: Schema.Number }),
      bottom: Schema.Struct({ height: Schema.Number }),
      left: Schema.Struct({ width: Schema.Number }),
      right: Schema.Struct({ width: Schema.Number })
    })
  })
});

export const designerSchema = createVoidsyncSchema({
  // Ephemeral state shared via awareness protocol (cursors, selections, presence)
  awareness: AwarenessSchema,

  // Local browser state, not synced (UI preferences, panel sizes)
  browser: BrowserSchema,

  // Persisted state synced to the document (uses @dff for mutations)
  synced: {
    nodes: syncMap<NodeData>()
  }
});

export type DesignerStateNodes = Record<string, NodeData>;

export type DesignerSchema = typeof designerSchema;
export type DesignerState = DesignerSchema['_types']['combined'];
