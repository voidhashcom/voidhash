import { createAwarenessActions } from './awareness-actions';
import { createCanvasActions } from './canvas-actions';
import { createDebugActions } from './debug-actions';
import { createColumnNodeActions } from './nodes/column-node-actions';
import { createRowNodeActions } from './nodes/row-node-actions';
import { createScreenNodeActions } from './nodes/screen-node-actions';
import { createTextNodeActions } from './nodes/text-node-actions';
import { createPanelActions } from './panel-actions';
import { createSelectionActions } from './selection-actions';
import { createToolsActions } from './tools-actions';
import type { DesignerStoreState } from './types';

export type { DesignerStoreState } from './types';

/**
 * Creates all designer store actions.
 * Each action group is modular and can be extended independently.
 */
export function createDesignerActions(storeState: DesignerStoreState) {
  return {
    ...createCanvasActions(storeState),
    ...createSelectionActions(storeState),
    ...createDebugActions(storeState),
    ...createPanelActions(storeState),
    ...createAwarenessActions(storeState),
    ...createToolsActions(storeState),
    ...createColumnNodeActions(storeState),
    ...createRowNodeActions(storeState),
    ...createScreenNodeActions(storeState),
    ...createTextNodeActions(storeState)
  };
}
