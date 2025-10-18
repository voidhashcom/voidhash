import { Rpc, RpcGroup } from '@effect/rpc';
import { ActionForbiddenError, PerkServiceError } from '@voidhash/shared';
import { Schema } from 'effect';
import { AuthMiddleware } from '../middlewares';

export class Perk extends Schema.Class<Perk>('Perk')({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  projectId: Schema.String
}) {}

export class PerkRpcsDef extends RpcGroup.make(
  Rpc.make('ListPerks', {
    success: Schema.Array(Perk),
    error: Schema.Union(ActionForbiddenError, PerkServiceError)
  })
).middleware(AuthMiddleware) {}
