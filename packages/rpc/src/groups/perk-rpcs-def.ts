import { Rpc, RpcGroup } from '@effect/rpc';
import {
  ActionForbiddenError,
  PerkNotFoundError,
  PerkServiceError,
  PerkSlugAlreadyExistsError
} from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export const Perk = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  projectId: Schema.String
});

export class PerkRpcsDef extends RpcGroup.make(
  Rpc.make('ListPerks', {
    payload: Schema.Struct({
      projectId: Schema.String
    }),
    success: Schema.Array(Perk),
    error: Schema.Union(ActionForbiddenError, PerkServiceError)
  }),
  Rpc.make('CreatePerk', {
    payload: Schema.Struct({
      projectId: Schema.String,
      name: Schema.String,
      slug: Schema.String
    }),
    success: Schema.Struct({
      id: Schema.String
    }),
    error: Schema.Union(
      ActionForbiddenError,
      PerkServiceError,
      PerkSlugAlreadyExistsError
    )
  }),
  Rpc.make('DeletePerk', {
    payload: Schema.Struct({
      perkId: Schema.String
    }),
    success: Schema.Void,
    error: Schema.Union(
      ActionForbiddenError,
      PerkServiceError,
      PerkNotFoundError
    )
  })
).middleware(AuthMiddleware) {}
