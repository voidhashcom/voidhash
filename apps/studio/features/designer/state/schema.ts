import { z } from 'zod';
import { createVoidsyncSchema, syncMap } from './core/voidsync';

// ============================================================================
// Shared Property Schemas
// ============================================================================

export const paddingSchema = z.object({
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number()
});

export const justifyContentSchema = z.enum([
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'space-evenly'
]);

export const alignItemsSchema = z.enum([
  'flex-start',
  'center',
  'flex-end',
  'stretch',
  'baseline'
]);

export const fontWeightSchema = z.enum([
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900'
]);

export const textAlignSchema = z.enum(['left', 'center', 'right', 'justify']);

export const safeAreaSchema = z.object({
  top: z.boolean(),
  bottom: z.boolean()
});

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
  height: z.number(),
  backgroundColor: z.string().default('#ffffff'),
  padding: paddingSchema.default({ top: 0, right: 0, bottom: 0, left: 0 }),
  safeArea: safeAreaSchema.default({ top: false, bottom: false })
});

export const textNodeSchema = baseNodeSchema.extend({
  x: z.number(),
  y: z.number(),
  type: z.literal('text'),
  text: z.string(),
  fontSize: z.number().default(16),
  color: z.string().default('#000000'),
  fontWeight: fontWeightSchema.default('400'),
  textAlign: textAlignSchema.default('left'),
  lineHeight: z.number().default(1.5),
  letterSpacing: z.number().default(0)
});

export const columnNodeSchema = baseNodeSchema.extend({
  type: z.literal('column'),
  gap: z.number().default(0),
  padding: paddingSchema.default({ top: 0, right: 0, bottom: 0, left: 0 }),
  justifyContent: justifyContentSchema.default('flex-start'),
  alignItems: alignItemsSchema.default('stretch'),
  backgroundColor: z.string().nullable().default(null)
});

export const rowNodeSchema = baseNodeSchema.extend({
  type: z.literal('row'),
  gap: z.number().default(0),
  padding: paddingSchema.default({ top: 0, right: 0, bottom: 0, left: 0 }),
  justifyContent: justifyContentSchema.default('flex-start'),
  alignItems: alignItemsSchema.default('stretch'),
  backgroundColor: z.string().nullable().default(null)
});

export const availableToolsSchema = z.enum([
  'cursor',
  'text',
  'rows',
  'columns',
  'scroll-view'
]);

export const nodeSchema = z.discriminatedUnion('type', [
  screenNodeSchema,
  textNodeSchema,
  rootNodeSchema,
  columnNodeSchema,
  rowNodeSchema
]);

export type NodeData = z.infer<typeof nodeSchema>;
export type RootNodeData = z.infer<typeof rootNodeSchema>;
export type ScreenNodeData = z.infer<typeof screenNodeSchema>;
export type TextNodeData = z.infer<typeof textNodeSchema>;
export type ColumnNodeData = z.infer<typeof columnNodeSchema>;
export type RowNodeData = z.infer<typeof rowNodeSchema>;

export type Padding = z.infer<typeof paddingSchema>;
export type JustifyContent = z.infer<typeof justifyContentSchema>;
export type AlignItems = z.infer<typeof alignItemsSchema>;
export type FontWeight = z.infer<typeof fontWeightSchema>;
export type TextAlign = z.infer<typeof textAlignSchema>;
export type SafeArea = z.infer<typeof safeAreaSchema>;

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
    highlightedNodeId: z.string().nullable(),
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
