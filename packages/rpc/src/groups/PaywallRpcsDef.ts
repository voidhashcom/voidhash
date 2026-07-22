import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Effect, Option, Schema, SchemaIssue, SchemaTransformation } from "effect";

import { RpcActionForbiddenError } from "../errors/common.ts";
import {
  RpcPaywallNotFoundError,
  RpcPaywallReleaseError,
  RpcPaywallServiceError,
  RpcPaywallSlugAlreadyExistsError,
  RpcReleaseNotFoundError,
} from "../errors/paywall.ts";
import { AuthMiddleware } from "../middlewares.ts";

const DateFromNumber = Schema.Number.pipe(
  Schema.decodeTo(
    Schema.Date,
    SchemaTransformation.transformOrFail({
      decode: (value) => {
        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(value), {
              message: "Expected a valid Date",
            }),
          );
        }

        return Effect.succeed(parsed);
      },
      encode: (value) => Effect.succeed(value.getTime()),
    }),
  ),
);

export const Paywall = Schema.Struct({
  archivedAt: Schema.NullOr(DateFromNumber),
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
});

export class PaywallRpcsDef extends RpcGroup.make(
  Rpc.make("ListPaywalls", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallServiceError]),
    payload: Schema.Struct({
      includeArchived: Schema.optional(Schema.Boolean),
      projectId: Schema.String,
    }),
    success: Schema.Array(Paywall),
  }),
  Rpc.make("CreatePaywall", {
    error: Schema.Union([
      RpcActionForbiddenError,
      RpcPaywallServiceError,
      RpcPaywallSlugAlreadyExistsError,
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
  Rpc.make("RenamePaywall", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallServiceError, RpcPaywallNotFoundError]),
    payload: Schema.Struct({
      name: Schema.String,
      paywallId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("ArchivePaywall", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallServiceError, RpcPaywallNotFoundError]),
    payload: Schema.Struct({
      paywallId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("RestorePaywall", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallServiceError, RpcPaywallNotFoundError]),
    payload: Schema.Struct({
      paywallId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("DeletePaywall", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallServiceError, RpcPaywallNotFoundError]),
    payload: Schema.Struct({
      paywallId: Schema.String,
    }),
    success: Schema.Void,
  }),
  Rpc.make("RequestPaywallEditToken", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallServiceError, RpcPaywallNotFoundError]),
    payload: Schema.Struct({
      paywallId: Schema.String,
    }),
    success: Schema.Struct({
      expiresAt: DateFromNumber,
      token: Schema.String,
      url: Schema.String,
    }),
  }),
  Rpc.make("CreatePaywallRelease", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallNotFoundError, RpcPaywallReleaseError]),
    payload: Schema.Struct({
      paywallId: Schema.String,
    }),
    success: Schema.Struct({
      createdAt: DateFromNumber,
      draftUrl: Schema.String,
      releaseId: Schema.String,
      version: Schema.Number,
    }),
  }),
  Rpc.make("PublishPaywallRelease", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallReleaseError, RpcReleaseNotFoundError]),
    payload: Schema.Struct({
      releaseId: Schema.String,
    }),
    success: Schema.Struct({
      htmlUrl: Schema.String,
      publishedAt: DateFromNumber,
      releaseId: Schema.String,
      version: Schema.Number,
    }),
  }),
  Rpc.make("GetPaywallDraftRelease", {
    error: Schema.Union([RpcActionForbiddenError, RpcPaywallNotFoundError, RpcPaywallReleaseError]),
    payload: Schema.Struct({
      paywallId: Schema.String,
    }),
    success: Schema.NullOr(
      Schema.Struct({
        createdAt: DateFromNumber,
        draftUrl: Schema.String,
        releaseId: Schema.String,
        version: Schema.Number,
      }),
    ),
  }),
).middleware(AuthMiddleware) {}
