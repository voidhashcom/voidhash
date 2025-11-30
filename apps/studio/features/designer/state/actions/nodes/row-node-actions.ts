import { IndexGenerator } from 'fractional-indexing-jittered';
import z from 'zod';
import {
  alignItemsSchema,
  justifyContentSchema,
  paddingSchema,
  type RowNodeData,
  rowNodeSchema
} from '../../schema';
import { createNodeId } from '../../utils/id';
import { getNodesByParentId } from '../../utils/nodes';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createRowNode = (storeState: DesignerStoreState) =>
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

      const rowNodeData = rowNodeSchema.parse({
        id,
        type: 'row',
        name: 'Row',
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        backgroundColor: null,
        parent: {
          id: params.parentId,
          index
        }
      } satisfies RowNodeData);

      doc.getMap('nodes').set(id, rowNodeData);
      dispatch(selectNode)({ id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  );

export const updateRowNode = (storeState: DesignerStoreState) =>
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
      if (!node || node.type !== 'row') {
        return;
      }

      const nodesMap = doc.getMap('nodes');
      const updatedNode: RowNodeData = {
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

export const createRowNodeActions = (storeState: DesignerStoreState) => ({
  createRowNode: createRowNode(storeState),
  updateRowNode: updateRowNode(storeState)
});
