import { z } from 'zod';
import type { DesignerStoreState } from './types';

/**
 * Creates awareness-related actions for the designer store.
 * These actions manage ephemeral state shared via the awareness protocol.
 */
export function createAwarenessActions(storeState: DesignerStoreState) {
  const updateCursor = storeState.action(
    z.object({ x: z.number(), y: z.number() }).nullable(),
    ({ setAwareness, params }) => {
      setAwareness({ cursor: params });
    }
  );

  const updateUser = storeState.action(
    z.object({
      name: z.string().optional(),
      color: z.string().optional()
    }),
    ({ getState, setAwareness, params }) => {
      setAwareness({
        user: {
          ...getState().user,
          ...params
        }
      });
    }
  );

  return {
    updateCursor,
    updateUser
  };
}

