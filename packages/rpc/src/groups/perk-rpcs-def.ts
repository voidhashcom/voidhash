import { Rpc, RpcGroup } from "@effect/rpc";
import {
  ActionForbiddenError,
  PerkNotFoundError,
  PerkServiceError,
  PerkSlugAlreadyExistsError,
} from "@voidhash/shared";
import { Schema } from "effect";

import { AuthMiddleware } from "../middlewares";

export const Perk = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
});

export class PerkRpcsDef extends RpcGroup.make(
  Rpc.make("ListPerks", {
    error: Schema.Union(ActionForbiddenError, PerkServiceError),
    payload: Schema.Struct({
      projectId: Schema.String,
    }),
    success: Schema.Array(Perk),
  }),
  Rpc.make("CreatePerk", {
    error: Schema.Union(
      ActionForbiddenError,
      PerkServiceError,
      PerkSlugAlreadyExistsError
    ),
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
    error: Schema.Union(
      ActionForbiddenError,
      PerkServiceError,
      PerkNotFoundError
    ),
    payload: Schema.Struct({
      perkId: Schema.String,
    }),
    success: Schema.Void,
  })
).middleware(AuthMiddleware) {}
