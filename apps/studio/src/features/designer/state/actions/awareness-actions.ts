import { Schema } from 'effect';
import type { DesignerStoreState } from './types';

/**
 * Creates awareness-related actions for the designer store.
 * These actions manage ephemeral state shared via the awareness protocol.
 */

export const updateCursor = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
    ({ setAwareness, params }) => {
      setAwareness({ cursor: params });
    }
  );

export const updateUser = (storeState: DesignerStoreState) =>
  storeState.action(
    Schema.Struct({
      name: Schema.optional(Schema.String),
      color: Schema.optional(Schema.String)
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

export const createAwarenessActions = (storeState: DesignerStoreState) => ({
  updateCursor: updateCursor(storeState),
  updateUser: updateUser(storeState)
});
