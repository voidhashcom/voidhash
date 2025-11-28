import type { DesignerStoreState } from './types';
import { createAwarenessActions } from './awareness-actions';
import { createDebugActions } from './debug-actions';
import { createNodeActions } from './node-actions';
import { createPanelActions } from './panel-actions';
import { createSelectionActions } from './selection-actions';

export type { DesignerStoreState } from './types';

/**
 * Creates all designer store actions.
 * Each action group is modular and can be extended independently.
 */
export function createDesignerActions(storeState: DesignerStoreState) {
  return {
    ...createNodeActions(storeState),
    ...createSelectionActions(storeState),
    ...createDebugActions(storeState),
    ...createPanelActions(storeState),
    ...createAwarenessActions(storeState)
  };
}

