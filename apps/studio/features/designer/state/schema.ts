import { z } from 'zod';
import {
  createVoidsyncSchema,
  syncMap
} from './core/voidsync';

// ============================================================================
// Node Schema
// ============================================================================

export const nodeSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});

export type NodeData = z.infer<typeof nodeSchema>;

// ============================================================================
// Designer Schema
// ============================================================================

export const designerSchema = createVoidsyncSchema({
  // Ephemeral state shared via awareness protocol (cursors, selections, presence)
  awareness: z.object({
    cursor: z
      .object({
        x: z.number(),
        y: z.number()
      })
      .nullable(),
    user: z.object({
      name: z.string(),
      color: z.string()
    })
  }),

  // Local browser state, not synced (UI preferences, panel sizes)
  browser: z.object({
    debug: z.object({
      showGrid: z.boolean()
    }),
    viewport: z.object({
      panels: z.object({
        top: z.object({ height: z.number() }),
        bottom: z.object({ height: z.number() }),
        left: z.object({ width: z.number() }),
        right: z.object({ width: z.number() })
      })
    }),
    selectedNodeId: z.string().nullable()
  }),

  // Persisted state synced to the document
  synced: {
    nodes: syncMap(nodeSchema)
  }
});

export type DesignerSchema = typeof designerSchema;
export type DesignerState = DesignerSchema['_types']['combined'];

