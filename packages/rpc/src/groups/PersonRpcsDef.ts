import { Rpc, RpcGroup } from "effect/unstable/rpc";
import * as Schema from "effect/Schema";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPersonInvalidAnonymousIdError,
  RpcPersonNotFoundError,
  RpcPersonServiceError,
} from "../errors/person.ts";
import { AuthMiddleware } from "../middlewares.ts";

export const Person = Schema.Struct({
  createdAt: Schema.NullOr(Schema.Date),
  personId: Schema.String,
  distinctId: Schema.String,
  email: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  type: Schema.Number,
});
export type Person = typeof Person.Type;

const productDetails = {
  productName: Schema.String,
  environment: Schema.Number,
  id: Schema.String,
};

/** Recorded purchases and perk grants visible in the requested environment. */
export const PersonPurchaseState = Schema.Struct({
  subscriptions: Schema.Array(
    Schema.Struct({
      ...productDetails,
      startsAt: Schema.Date,
      expiresAt: Schema.NullOr(Schema.Date),
      gracePeriodExpiresAt: Schema.NullOr(Schema.Date),
      status: Schema.Number,
      willCancelAtPeriodEnd: Schema.Boolean,
    }),
  ),
  purchases: Schema.Array(
    Schema.Struct({
      ...productDetails,
      createdAt: Schema.NullOr(Schema.Date),
      refundedAt: Schema.NullOr(Schema.Date),
      revokedAt: Schema.NullOr(Schema.Date),
    }),
  ),
  grants: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      perkName: Schema.String,
      environment: Schema.Number,
      expiresAt: Schema.NullOr(Schema.Date),
      status: Schema.Number,
    }),
  ),
});
export type PersonPurchaseState = typeof PersonPurchaseState.Type;

export class PersonRpcsDef extends RpcGroup.make(
  Rpc.make("GetPersonPurchaseState", {
    error: Schema.Union([RpcActionForbiddenError, RpcPersonNotFoundError, RpcPersonServiceError]),
    payload: { personId: Schema.String, projectId: Schema.String },
    success: PersonPurchaseState,
  }),
  Rpc.make("CreatePerson", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPersonInvalidAnonymousIdError,
      RpcPersonServiceError,
    ]),
    payload: {
      distinctId: Schema.String,
      email: Schema.optional(Schema.String),
      name: Schema.optional(Schema.String),
      projectId: Schema.String,
    },
    success: Person,
  }),
  Rpc.make("ListPersons", {
    error: Schema.Union([RpcActionForbiddenError, RpcPersonServiceError]),
    payload: {
      projectId: Schema.String,
    },
    success: Schema.Array(Person),
  }),
  Rpc.make("GetPersonById", {
    error: Schema.Union([RpcActionForbiddenError, RpcPersonNotFoundError, RpcPersonServiceError]),
    payload: {
      personId: Schema.String,
    },
    success: Person,
  }),
  Rpc.make("GetPersonByDistinctId", {
    error: Schema.Union([RpcActionForbiddenError, RpcPersonNotFoundError, RpcPersonServiceError]),
    payload: {
      distinctId: Schema.String,
      projectId: Schema.String,
    },
    success: Person,
  }),
).middleware(AuthMiddleware) {}
