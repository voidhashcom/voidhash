import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPerkNotFoundError,
  RpcPerkServiceError,
  RpcPerkSlugAlreadyExistsError,
} from "../errors/perk.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const Perk = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
});
export type Perk = typeof Perk.Type;

export class PerkRpcsDef extends RpcGroup.make(
  Rpc.make("ListPerks", {
    error: Schema.Union([RpcActionForbiddenError, RpcPerkServiceError]),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(Perk),
  }),
  Rpc.make("CreatePerk", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPerkServiceError,
      RpcPerkSlugAlreadyExistsError,
    ]),
    payload: Schema.Struct({
      name: Schema.String,
      projectId: Schema.String,
      slug: Schema.String,
    }),
    success: Schema.Struct({
      id: Schema.String,
    }),
  }),
  Rpc.make("DeletePerk", {
    error: Schema.Union([RpcActionForbiddenError, RpcPerkServiceError, RpcPerkNotFoundError]),
    payload: Schema.Struct({
      perkId: Schema.String,
    }),
    success: Schema.Void,
  }),
).middleware(AuthMiddleware) {}
