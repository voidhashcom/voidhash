import { IndexGenerator } from 'fractional-indexing-jittered';
import z from 'zod';
import {
  fontWeightSchema,
  type TextNodeData,
  textAlignSchema,
  textNodeSchema
} from '../../schema';
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
        fontSize: 16,
        color: '#000000',
        fontWeight: '400',
        textAlign: 'left',
        lineHeight: 1.5,
        letterSpacing: 0,
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

export const updateTextNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({
      id: z.string(),
      text: z.string().optional(),
      fontSize: z.number().optional(),
      color: z.string().optional(),
      fontWeight: fontWeightSchema.optional(),
      textAlign: textAlignSchema.optional(),
      lineHeight: z.number().optional(),
      letterSpacing: z.number().optional()
    }),
    ({ params, getState, doc }) => {
      const state = getState();
      const node = state.nodes?.[params.id];
      if (!node || node.type !== 'text') {
        return;
      }

      const nodesMap = doc.getMap('nodes');
      const updatedNode: TextNodeData = {
        ...node,
        text: params.text ?? node.text,
        fontSize: params.fontSize ?? node.fontSize,
        color: params.color ?? node.color,
        fontWeight: params.fontWeight ?? node.fontWeight,
        textAlign: params.textAlign ?? node.textAlign,
        lineHeight: params.lineHeight ?? node.lineHeight,
        letterSpacing: params.letterSpacing ?? node.letterSpacing
      };

      nodesMap.set(params.id, updatedNode);
    }
  );

export const createTextNodeActions = (storeState: DesignerStoreState) => ({
  createTextNode: createTextNode(storeState),
  updateTextNode: updateTextNode(storeState)
});
