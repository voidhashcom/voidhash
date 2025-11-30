import z from 'zod';
import {
  paddingSchema,
  type ScreenNodeData,
  safeAreaSchema
} from '../../schema';
import type { DesignerStoreState } from '../types';

export const updateScreenNode = (storeState: DesignerStoreState) =>
  storeState.action(
    z.object({
      id: z.string(),
      backgroundColor: z.string().optional(),
      padding: paddingSchema.optional(),
      safeArea: safeAreaSchema.optional()
    }),
    ({ params, getState, doc }) => {
      const state = getState();
      const node = state.nodes?.[params.id];
      if (!node || node.type !== 'screen') {
        return;
      }

      const nodesMap = doc.getMap('nodes');
      const updatedNode: ScreenNodeData = {
        ...node,
        backgroundColor: params.backgroundColor ?? node.backgroundColor,
        padding: params.padding ?? node.padding,
        safeArea: params.safeArea ?? node.safeArea
      };

      nodesMap.set(params.id, updatedNode);
    }
  );

export const createScreenNodeActions = (storeState: DesignerStoreState) => ({
  updateScreenNode: updateScreenNode(storeState)
});
