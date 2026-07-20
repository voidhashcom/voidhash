import { Schema, SchemaTransformation } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

const DateValidFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.DateValid,
    SchemaTransformation.transform({
      decode: (value: string) => new Date(value),
      encode: (value: Date) => value.toISOString(),
    }),
  ),
);

const SafeLinkValue = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(1_024)),
);

export const LinkCampaign = Schema.Struct({
  ad: Schema.optional(SafeLinkValue),
  adSet: Schema.optional(SafeLinkValue),
  campaign: Schema.optional(SafeLinkValue),
  channel: Schema.optional(SafeLinkValue),
  mediaSource: Schema.optional(SafeLinkValue),
});

export const LinkDestination = Schema.Struct({
  androidStoreUrl: Schema.optional(SafeLinkValue),
  appleAppId: Schema.optional(SafeLinkValue),
  baseDeepLink: Schema.optional(SafeLinkValue),
  deepLinkValue: SafeLinkValue,
  iosStoreUrl: Schema.optional(SafeLinkValue),
  subvalues: Schema.optional(Schema.Record(Schema.String, SafeLinkValue)),
  webFallbackUrl: Schema.optional(SafeLinkValue),
});

/** Project-scoped request for an immutable signed short-link definition. */
export const CreateLinkRequest = Schema.Struct({
  brandedDomain: Schema.optional(SafeLinkValue),
  campaign: Schema.optional(LinkCampaign),
  customParameters: Schema.optional(Schema.Record(Schema.String, SafeLinkValue)),
  destination: LinkDestination,
  expiresAt: Schema.optional(DateValidFromString),
  idempotencyKey: Schema.optional(SafeLinkValue),
  referrerCustomerId: Schema.optional(SafeLinkValue),
  referrerImageUrl: Schema.optional(SafeLinkValue),
  referrerName: Schema.optional(SafeLinkValue),
  referrerUid: Schema.optional(SafeLinkValue),
  templateId: Schema.optional(SafeLinkValue),
  token: SafeLinkValue,
});

export class CreateLinkResponse extends Schema.Class<CreateLinkResponse>("CreateLinkResponse")({
  expiresAt: DateValidFromString,
  linkId: SafeLinkValue,
  url: SafeLinkValue,
}) {}

export const ResolveDeferredLinkRequest = Schema.Struct({
  deferredToken: SafeLinkValue,
  installationId: SafeLinkValue,
  platform: Schema.Literals(["ios", "android"]),
  token: SafeLinkValue,
});

export const DeferredLinkFound = Schema.Struct({
  campaign: Schema.optional(LinkCampaign),
  clickId: SafeLinkValue,
  clickedAt: DateValidFromString,
  deferred: Schema.Literal(true),
  expiresAt: DateValidFromString,
  linkId: SafeLinkValue,
  route: Schema.Struct({
    subvalues: Schema.Record(Schema.String, SafeLinkValue),
    value: SafeLinkValue,
  }),
  signature: SafeLinkValue,
  status: Schema.Literal("found"),
});

export const DeferredLinkNotFound = Schema.Struct({
  reason: Schema.Literals(["expired", "not-found", "replayed", "invalid"]),
  status: Schema.Literal("notFound"),
});

export const ResolveDeferredLinkResponse = Schema.Struct({
  campaign: Schema.optional(LinkCampaign),
  clickId: Schema.optional(SafeLinkValue),
  clickedAt: Schema.optional(DateValidFromString),
  deferred: Schema.optional(Schema.Literal(true)),
  expiresAt: Schema.optional(DateValidFromString),
  linkId: Schema.optional(SafeLinkValue),
  reason: Schema.optional(Schema.Literals(["expired", "not-found", "replayed", "invalid"])),
  route: Schema.optional(Schema.Struct({
    subvalues: Schema.Record(Schema.String, SafeLinkValue),
    value: SafeLinkValue,
  })),
  signature: Schema.optional(SafeLinkValue),
  status: Schema.Literals(["found", "notFound"]),
});

export class LinkInvalidRequestError extends Schema.TaggedErrorClass<LinkInvalidRequestError>()(
  "LinkInvalidRequestError",
  { code: Schema.Literal("invalid_link_request"), error: Schema.NonEmptyString },
  { httpApiStatus: 400 },
) {}

export class LinkUnauthorizedError extends Schema.TaggedErrorClass<LinkUnauthorizedError>()(
  "LinkUnauthorizedError",
  { code: Schema.Literal("unauthorized"), error: Schema.NonEmptyString },
  { httpApiStatus: 401 },
) {}

export class LinkRateLimitedError extends Schema.TaggedErrorClass<LinkRateLimitedError>()(
  "LinkRateLimitedError",
  { code: Schema.Literal("rate_limited"), error: Schema.NonEmptyString },
  { httpApiStatus: 429 },
) {}

export class LinkServiceUnavailableError extends Schema.TaggedErrorClass<LinkServiceUnavailableError>()(
  "LinkServiceUnavailableError",
  { code: Schema.Literal("service_unavailable"), error: Schema.NonEmptyString },
  { httpApiStatus: 503 },
) {}

export const LinksApi = HttpApi.make("LinksApi").add(
  HttpApiGroup.make("links")
    .add(HttpApiEndpoint.post("createLink", "/links", {
      error: [LinkInvalidRequestError, LinkUnauthorizedError, LinkRateLimitedError, LinkServiceUnavailableError],
      payload: CreateLinkRequest,
      success: CreateLinkResponse.pipe(HttpApiSchema.status(201)),
    }))
    .add(HttpApiEndpoint.post("resolveDeferredLink", "/deferred/resolve", {
      error: [LinkInvalidRequestError, LinkUnauthorizedError, LinkRateLimitedError, LinkServiceUnavailableError],
      payload: ResolveDeferredLinkRequest,
      success: ResolveDeferredLinkResponse,
    }))
    .prefix("/l/v1"),
);
