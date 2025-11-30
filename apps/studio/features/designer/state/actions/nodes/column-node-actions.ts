import { IndexGenerator } from 'fractional-indexing-jittered';
import z from 'zod';
import {
  alignItemsSchema,
  type ColumnNodeData,
  columnNodeSchema,
  justifyContentSchema,
  paddingSchema
} from '../../schema';
import { createNodeId } from '../../utils/id';
import { getNodesByParentId } from '../../utils/nodes';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createColumnNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({ parentId: z.string() }),
    ({ params, getState, doc, dispatch }) => {
      const state = getState();
      const node = state.nodes?.[params.parentId];
      if (!node) {
        return;
      }
      const id = createNodeId();
      const existingParentChildren = getNodesByParentId(
        state.nodes,
        params.parentId
      );
      const fractionalIndexes = existingParentChildren.map(
        (n) => n.parent.index
      );
      const generator = new IndexGenerator(fractionalIndexes);
      const index = generator.keyEnd();

      const columnNodeData = columnNodeSchema.parse({
        id,
        type: 'column',
        name: 'Column',
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        backgroundColor: null,
        parent: {
          id: params.parentId,
          index
        }
      } satisfies ColumnNodeData);

      doc.getMap('nodes').set(id, columnNodeData);
      dispatch(selectNode)({ id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  );

export const updateColumnNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({
      id: z.string(),
      gap: z.number().optional(),
      padding: paddingSchema.optional(),
      justifyContent: justifyContentSchema.optional(),
      alignItems: alignItemsSchema.optional(),
      backgroundColor: z.string().nullable().optional()
    }),
    ({ params, getState, doc }) => {
      const state = getState();
      const node = state.nodes?.[params.id];
      if (!node || node.type !== 'column') {
        return;
      }

      const nodesMap = doc.getMap('nodes');
      const updatedNode: ColumnNodeData = {
        ...node,
        gap: params.gap ?? node.gap,
        padding: params.padding ?? node.padding,
        justifyContent: params.justifyContent ?? node.justifyContent,
        alignItems: params.alignItems ?? node.alignItems,
        backgroundColor:
          params.backgroundColor !== undefined
            ? params.backgroundColor
            : node.backgroundColor
      };

      nodesMap.set(params.id, updatedNode);
    }
  );

export const createColumnNodeActions = (storeState: DesignerStoreState) => ({
  createColumnNode: createColumnNode(storeState),
  updateColumnNode: updateColumnNode(storeState)
});
