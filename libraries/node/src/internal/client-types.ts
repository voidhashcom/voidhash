import type { VoidhashV1Api } from "@voidhash/api-spec";
import type { Effect } from "effect";
import type * as Schema from "effect/Schema";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";
import type { HttpClientResponse } from "effect/unstable/http";
import type { HttpApiSchemaError } from "effect/unstable/httpapi/HttpApiError";
import type {
  HttpApi,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
} from "effect/unstable/httpapi";
import type { Brand } from "effect/Brand";
import type * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema";

type Simplify<T> = { [Key in keyof T]: T[Key] } & {};

type ApiGroups<Api extends HttpApi.Any> =
  Api extends HttpApi.HttpApi<infer _ApiId, infer Groups> ? Groups : never;

type EncodedClientRequest<
  Params extends Schema.Top,
  Query extends Schema.Top,
  Payload extends Schema.Top,
  Headers extends Schema.Top,
  WithResponse extends boolean,
> = (
  & ([Params["Encoded"]] extends [never]
    ? {}
    : { readonly params: Params["Encoded"] })
  & ([Query["Encoded"]] extends [never]
    ? {}
    : { readonly query: Query["Encoded"] })
  & ([Headers["Encoded"]] extends [never]
    ? {}
    : { readonly headers: Headers["Encoded"] })
  & ([Payload["Encoded"]] extends [never]
    ? {}
    : Payload["Encoded"] extends infer EncodedPayload
      ? EncodedPayload extends
          | Brand<HttpApiSchema.MultipartTypeId>
          | Brand<HttpApiSchema.MultipartStreamTypeId>
        ? { readonly payload: FormData }
        : { readonly payload: Payload["Encoded"] }
      : { readonly payload: Payload["Encoded"] })
) extends infer Request
  ? keyof Request extends never
    ? void | { readonly withResponse?: WithResponse }
    : Request & { readonly withResponse?: WithResponse }
  : void;

type EffectMethod<Endpoint> =
  Endpoint extends HttpApiEndpoint.HttpApiEndpoint<
    infer _Name,
    infer _Method,
    infer _Path,
    infer Params,
    infer Query,
    infer Payload,
    infer Headers,
    infer Success,
    infer Error,
    infer Middleware,
    infer _MR
  >
    ? <WithResponse extends boolean = false>(
        request: Simplify<
          EncodedClientRequest<Params, Query, Payload, Headers, WithResponse>
        >
      ) => Effect.Effect<
        WithResponse extends true
          ? [Success["Type"], HttpClientResponse.HttpClientResponse]
          : Success["Type"],
        | Error["Type"]
        | HttpApiMiddleware.Error<Middleware>
        | HttpApiMiddleware.ClientError<Middleware>
        | HttpApiSchemaError
        | HttpClientError.HttpClientError
        | Schema.SchemaError,
        | Params["DecodingServices"]
        | Query["DecodingServices"]
        | Payload["DecodingServices"]
        | Headers["DecodingServices"]
        | Params["EncodingServices"]
        | Query["EncodingServices"]
        | Payload["EncodingServices"]
        | Headers["EncodingServices"]
        | Success["DecodingServices"]
        | Error["DecodingServices"]
      >
    : never;

type EffectTopLevelMethods<Groups extends HttpApiGroup.Any> =
  Extract<Groups, { readonly topLevel: true }> extends
    HttpApiGroup.HttpApiGroup<infer _Id, infer Endpoints, infer _TopLevel>
    ? Endpoints extends infer Endpoint
      ? [HttpApiEndpoint.Name<Endpoint>, EffectMethod<Endpoint>]
      : never
    : never;

type EffectClient<Groups extends HttpApiGroup.Any> = Simplify<
  & {
    readonly [Group in Extract<Groups, { readonly topLevel: false }> as HttpApiGroup.Name<Group>]:
      Group extends HttpApiGroup.HttpApiGroup<infer _GroupName, infer Endpoints>
        ? {
            readonly [Endpoint in Endpoints as HttpApiEndpoint.Name<Endpoint>]:
              EffectMethod<Endpoint>;
          }
        : never;
  }
  & {
    readonly [Method in EffectTopLevelMethods<Groups> as Method[0]]: Method[1];
  }
>;

type PromiseTopLevelMethods<Groups extends HttpApiGroup.Any> =
  Extract<Groups, { readonly topLevel: true }> extends
    HttpApiGroup.HttpApiGroup<infer _Id, infer Endpoints, infer _TopLevel>
    ? Endpoints extends infer Endpoint
      ? [HttpApiEndpoint.Name<Endpoint>, PromiseMethod<Endpoint>]
      : never
    : never;

type PromiseMethod<Endpoint> =
  Endpoint extends HttpApiEndpoint.HttpApiEndpoint<
    infer _Name,
    infer _Method,
    infer _Path,
    infer Params,
    infer Query,
    infer Payload,
    infer Headers,
    infer Success,
    infer _Error,
    infer _Middleware,
    infer _MR
  >
    ? <WithResponse extends boolean = false>(
        request: Simplify<
          EncodedClientRequest<Params, Query, Payload, Headers, WithResponse>
        >
      ) => Promise<
        WithResponse extends true
          ? [Success["Type"], HttpClientResponse.HttpClientResponse]
          : Success["Type"]
      >
    : never;

type PromiseClient<Groups extends HttpApiGroup.Any> = Simplify<
  & {
    readonly [Group in Extract<Groups, { readonly topLevel: false }> as HttpApiGroup.Name<Group>]:
      Group extends HttpApiGroup.HttpApiGroup<infer _GroupName, infer Endpoints>
        ? {
            readonly [Endpoint in Endpoints as HttpApiEndpoint.Name<Endpoint>]:
              PromiseMethod<Endpoint>;
          }
        : never;
  }
  & {
    readonly [Method in PromiseTopLevelMethods<Groups> as Method[0]]: Method[1];
  }
>;

type PromiseClientForApi<Api extends HttpApi.Any> =
  Api extends HttpApi.HttpApi<infer _ApiId, infer Groups> ? PromiseClient<Groups> : never;

export type GeneratedVoidhashNodeEffectClient = HttpApiClient.ForApi<typeof VoidhashV1Api>;
export type PublicVoidhashNodeEffectClient = EffectClient<ApiGroups<typeof VoidhashV1Api>>;

export type GeneratedVoidhashNodeClient = PromiseClientForApi<typeof VoidhashV1Api>;
export type PublicVoidhashNodeClient = PromiseClientForApi<typeof VoidhashV1Api>;
