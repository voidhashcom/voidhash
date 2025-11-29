import { IndexGenerator } from 'fractional-indexing-jittered';
import z from 'zod';
import { type TextNodeData, textNodeSchema } from '../../schema';
import { createNodeId } from '../../utils/id';
import { getNodesByParentId } from '../../utils/nodes';
import { selectNode } from '../selection-actions';
import { setActiveTool } from '../tools-actions';
import type { DesignerStoreState } from '../types';

export const createTextNode = (storeState: DesignerStoreState) =>
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

      const textNodeData = textNodeSchema.parse({
        id,
        type: 'text',
        name: 'Text 1',
        x: 0,
        y: 0,
        text: 'New Text',
        parent: {
          id: params.parentId,
          index
        }
      } satisfies TextNodeData);

      doc.getMap('nodes').set(id, textNodeData);
      dispatch(selectNode)({ id, many: false });
      dispatch(setActiveTool)({ tool: 'cursor' });
    }
  );

export const createTextNodeActions = (storeState: DesignerStoreState) => ({
  createTextNode: createTextNode(storeState)
});
