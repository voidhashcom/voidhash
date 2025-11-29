import { z } from 'zod';
import { createVoidsyncSchema, syncMap } from './core/voidsync';

// ============================================================================
// Node Schema
// ============================================================================

export const rootNodeSchema = z.object({
  type: z.literal('root'),
  id: z.string()
});

export const baseNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent: z.object({
    id: z.string(),
    index: z.string() // Fractional index - https://www.npmjs.com/package/fractional-indexing-jittered
  })
});

export const screenNodeSchema = baseNodeSchema.extend({
  type: z.literal('screen'),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});

export const textNodeSchema = baseNodeSchema.extend({
  x: z.number(),
  y: z.number(),
  type: z.literal('text'),
  text: z.string()
});

export const availableToolsSchema = z.enum(['cursor', 'text']);

export const nodeSchema = z.discriminatedUnion('type', [
  screenNodeSchema,
  textNodeSchema,
  rootNodeSchema
]);

export type NodeData = z.infer<typeof nodeSchema>;
export type RootNodeData = z.infer<typeof rootNodeSchema>;
export type ScreenNodeData = z.infer<typeof screenNodeSchema>;
export type TextNodeData = z.infer<typeof textNodeSchema>;
export type NodeDataWithoutRoot = Exclude<NodeData, RootNodeData>;

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
    }),
    selectedNodeIds: z.array(z.string()).default([])
  }),

  // Local browser state, not synced (UI preferences, panel sizes)
  browser: z.object({
    debug: z.object({
      showGrid: z.boolean()
    }),
    tools: z.object({
      activeTool: availableToolsSchema
    }),
    canvas: z.object({
      scale: z.number(),
      x: z.number(),
      y: z.number(),
      boundingBoxes: z.record(
        z.string(),
        z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number()
        })
      )
    }),
    viewport: z.object({
      panels: z.object({
        top: z.object({ height: z.number() }),
        bottom: z.object({ height: z.number() }),
        left: z.object({ width: z.number() }),
        right: z.object({ width: z.number() })
      })
    })
  }),

  // Persisted state synced to the document
  synced: {
    nodes: syncMap(nodeSchema)
  }
});

export type DesignerStateNodes = Record<string, z.infer<typeof nodeSchema>>;

export type DesignerSchema = typeof designerSchema;
export type DesignerState = DesignerSchema['_types']['combined'];
