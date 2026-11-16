/* oxlint-disable effect/prefer-option-over-null -- request ids, headers and cursors mirror the protocol's JSON and Node's header records, where null and undefined are the values on the wire. */
import {
  CatalogListInput,
  CatalogListResult,
  HistoryListInput,
  PROVIDER_ERROR_HIDDEN_MESSAGE,
  PROVIDER_PROTOCOL_VERSION,
  PROVIDER_SIGNATURE_HEADER,
  PROVIDER_SIGNATURE_TOLERANCE_SECONDS,
  PROVIDER_TIMESTAMP_HEADER,
  ProviderErrorStatus,
  ProviderHandlerErrorCode,
  ProviderRequest,
  SubscriptionCancelInput,
  SubscriptionCancelResult,
  SubscriptionGetInput,
  SubscriptionGetResult,
  SubscriptionHistoryResult,
  TransactionHistoryResult,
  TransactionRefundInput,
  TransactionRefundResult,
  type ProviderCatalogProduct,
  type ProviderEnvironment,
  type ProviderErrorCode,
  type ProviderOperation,
  ProviderResponse,
  type ProviderSubscription,
  type ProviderSubscriptionStatus,
  type ProviderTransaction,
  type DescribeResult,
  type HistoryKind,
  type HistoryListResult,
  type ProviderProductKind,
} from "@voidhash/api-contracts/payment-source-provider-protocol";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { concatBytes, utf8ToBytes } from "@noble/hashes/utils.js";

import { version as SDK_VERSION } from "../package.json";
import { computeSignature, currentUtc, verifyWebhookSignature } from "./webhooks";

export type {
  CatalogListInput,
  CatalogListResult,
  DescribeResult,
  HistoryKind,
  HistoryListInput,
  HistoryListResult,
  ProviderCatalogProduct,
  ProviderEnvironment,
  ProviderErrorCode,
  ProviderOperation,
  ProviderProductKind,
  ProviderResponse,
  ProviderSubscription,
  ProviderSubscriptionStatus,
  ProviderTransaction,
  SubscriptionCancelInput,
  SubscriptionCancelResult,
  SubscriptionGetInput,
  SubscriptionGetResult,
  TransactionRefundInput,
  TransactionRefundResult,
};

/** The codes an implementation may fail with on purpose through {@link ProviderError}. */
export type { ProviderHandlerErrorCode };

const SDK_NAME = "@voidhash/node";

/**
 * Throw from an operation to answer Voidhash with a deliberate error:
 * `not_found` when nothing matches the input, `unavailable` when your payment
 * provider is down (Voidhash retries later), `invalid_request` when the input
 * makes no sense to you. The message is returned as is, so keep it free of
 * secrets. Anything else an operation throws is answered as `provider_error`.
 */
export class ProviderError extends Error {
  readonly code: ProviderHandlerErrorCode;

  constructor(code: ProviderHandlerErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/** What every operation receives besides its input. */
export interface ProviderRequestContext {
  /** Unique per request; useful to correlate your logs with Voidhash's. */
  readonly requestId: string;
  /** Whether Voidhash asks about your provider's live or test data. */
  readonly environment: ProviderEnvironment;
}

type Awaitable<T> = T | PromiseLike<T>;

/** Options of {@link defineProvider}. Leave out the operations you do not support. */
export interface ProviderDefinition {
  /** The slug of the payment source, as created in Voidhash. */
  readonly source: string;
  /** The source's endpoint signing secret (`vhps_...`). */
  readonly signingSecret: string;
  /** Lists the products payments name in `productKey`, for the product import. */
  readonly catalog?: {
    readonly list: (
      input: CatalogListInput,
      context: ProviderRequestContext,
    ) => Awaitable<CatalogListResult>;
  };
  /**
   * Pages through subscriptions or transactions created before `input.before`,
   * for the history import. Return items of the requested `kind`.
   */
  readonly history?: {
    readonly list: (
      input: HistoryListInput,
      context: ProviderRequestContext,
    ) => Awaitable<HistoryListResult>;
  };
  readonly subscriptions?: {
    /** Returns one subscription's current state, or `{ subscription: null }` when unknown. */
    readonly get?: (
      input: SubscriptionGetInput,
      context: ProviderRequestContext,
    ) => Awaitable<SubscriptionGetResult>;
    /**
     * Cancels a subscription at your provider, at the end of its period when
     * `input.atPeriodEnd` is true, otherwise at once. Return the subscription's
     * state afterwards; Voidhash records it as if you had pushed it.
     */
    readonly cancel?: (
      input: SubscriptionCancelInput,
      context: ProviderRequestContext,
    ) => Awaitable<SubscriptionCancelResult>;
  };
  readonly transactions?: {
    /**
     * Refunds a charge at your provider: `input.amount` in minor units, or
     * `null` for everything not yet refunded. Return the refund transaction
     * (`type: "refund"`); Voidhash records it as if you had pushed it.
     */
    readonly refund?: (
      input: TransactionRefundInput,
      context: ProviderRequestContext,
    ) => Awaitable<TransactionRefundResult>;
  };
}

/** A raw request, as your framework received it. */
export interface ProviderHttpRequest {
  /** The body exactly as received; never a re-serialized object. */
  readonly body: string;
  /** Request headers, looked up case-insensitively. */
  readonly headers: Headers | Readonly<Record<string, string | ReadonlyArray<string> | undefined>>;
  /** Current time; injectable for tests. Defaults to the current time. */
  readonly now?: Date;
}

/** The status and JSON body to answer with. */
export interface ProviderHttpResponse {
  readonly status: number;
  readonly body: ProviderResponse;
}

/** A request {@link VoidhashProvider.test} signs and runs through the handler. */
export type ProviderTestRequest = (
  | { readonly operation: "describe"; readonly input?: Record<string, never> }
  | { readonly operation: "catalog.list"; readonly input: CatalogListInput }
  | { readonly operation: "history.list"; readonly input: HistoryListInput }
  | { readonly operation: "subscription.get"; readonly input: SubscriptionGetInput }
  | { readonly operation: "subscription.cancel"; readonly input: SubscriptionCancelInput }
  | { readonly operation: "transaction.refund"; readonly input: TransactionRefundInput }
) & {
  /** Defaults to `"test"`, so a failing operation's message is shown. */
  readonly environment?: ProviderEnvironment;
  /** Defaults to `"preq_test"`. */
  readonly requestId?: string;
};

/** A payment source's endpoint, ready to mount. */
export interface VoidhashProvider {
  readonly source: string;
  /** The operations the endpoint answers, sorted, including `describe`. */
  readonly operations: ReadonlyArray<ProviderOperation>;
  /**
   * Fetch-style handler for runtimes that speak `Request`/`Response`: Next.js
   * route handlers, Bun, Deno, Cloudflare Workers, Hono.
   */
  readonly handler: (request: Request) => Promise<Response>;
  /** Verifies and answers a raw request; for frameworks the adapters do not cover. */
  readonly handle: (request: ProviderHttpRequest) => Promise<ProviderHttpResponse>;
  /**
   * Signs a request with the provider's secret and runs it through the
   * handler, for unit tests of your operations. The body is the JSON
   * response, so dates are ISO 8601 strings.
   */
  readonly test: (request: ProviderTestRequest) => Promise<ProviderHttpResponse>;
}

const decodeJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown));
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const decodeEnvelope = Schema.decodeUnknownResult(ProviderRequest);
const decodeResponse = Schema.decodeSync(Schema.fromJsonString(ProviderResponse));
const isHandlerErrorCode = Schema.is(ProviderHandlerErrorCode);

const failure = (
  id: string | null,
  code: ProviderErrorCode,
  message: string,
): ProviderHttpResponse => ({
  body: { error: { code, message }, id },
  status: ProviderErrorStatus[code],
});

const readHeader = (
  headers: ProviderHttpRequest["headers"],
  name: string,
): Option.Option<string> => {
  if (headers instanceof Headers) {
    return Option.fromNullishOr(headers.get(name));
  }

  const entry = R.toEntries(headers).find(([key]) => key.toLowerCase() === name);
  const value = entry?.[1];

  // A repeated signing header is ambiguous, so it counts as missing.
  if (P.isString(value)) {
    return Option.some(value);
  }

  if (value?.length === 1) {
    return Option.fromNullishOr(value[0]);
  }

  return Option.none();
};

const isSignedRequest = (definition: ProviderDefinition, request: ProviderHttpRequest): boolean => {
  const timestamp = readHeader(request.headers, PROVIDER_TIMESTAMP_HEADER);
  const signature = readHeader(request.headers, PROVIDER_SIGNATURE_HEADER);

  if (Option.isNone(timestamp) || Option.isNone(signature)) {
    return false;
  }

  return verifyWebhookSignature({
    now: request.now === undefined ? currentUtc() : DateTime.fromDateUnsafe(request.now),
    payload: request.body,
    secret: definition.signingSecret,
    signature: signature.value,
    timestamp: timestamp.value,
    toleranceSeconds: PROVIDER_SIGNATURE_TOLERANCE_SECONDS,
  });
};

const errorMessage = (error: unknown): string => {
  if (P.isError(error)) {
    return error.message;
  }

  return String(error);
};

/**
 * Runs one operation: decodes its input, calls the implementation, and checks
 * what it returned against the protocol before it is sent.
 */
const runOperation = async <Input, Encoded>(
  envelope: ProviderRequest,
  inputSchema: Schema.Codec<Input, Encoded>,
  implementation: (input: Input, context: ProviderRequestContext) => Awaitable<unknown>,
  resultSchema: (input: Input) => Schema.Codec<unknown, unknown>,
): Promise<ProviderHttpResponse> => {
  const input = Schema.decodeUnknownResult(Schema.toCodecJson(inputSchema))(envelope.input);

  if (Result.isFailure(input)) {
    return failure(
      envelope.id,
      "invalid_request",
      `Invalid ${envelope.operation} input: ${input.failure.message}`,
    );
  }

  const output = await Promise.resolve()
    .then(() =>
      implementation(input.success, {
        environment: envelope.environment,
        requestId: envelope.id,
      }),
    )
    .then(Result.succeed, Result.fail);

  if (Result.isFailure(output)) {
    const error = output.failure;

    if (error instanceof ProviderError && isHandlerErrorCode(error.code)) {
      return failure(envelope.id, error.code, error.message);
    }

    return failure(
      envelope.id,
      "provider_error",
      envelope.environment === "test" ? errorMessage(error) : PROVIDER_ERROR_HIDDEN_MESSAGE,
    );
  }

  const result = Schema.encodeUnknownResult(Schema.toCodecJson(resultSchema(input.success)))(
    output.success,
  );

  if (Result.isFailure(result)) {
    return failure(
      envelope.id,
      "invalid_result",
      `Invalid ${envelope.operation} result: ${result.failure.message}`,
    );
  }

  return { body: { id: envelope.id, result: result.success }, status: 200 };
};

/** The operations a definition implements, sorted, including `describe`. */
const implementedOperations = (definition: ProviderDefinition): Array<ProviderOperation> => {
  const operations: Array<ProviderOperation> = ["describe"];
  if (definition.catalog) operations.push("catalog.list");
  if (definition.history) operations.push("history.list");
  if (definition.subscriptions?.get) operations.push("subscription.get");
  if (definition.subscriptions?.cancel) operations.push("subscription.cancel");
  if (definition.transactions?.refund) operations.push("transaction.refund");
  return Arr.sort(operations, Str.Order);
};

const answer = (
  definition: ProviderDefinition,
  operations: ReadonlyArray<ProviderOperation>,
  envelope: ProviderRequest,
): Promise<ProviderHttpResponse> => {
  const unsupported = () =>
    Promise.resolve(
      failure(
        envelope.id,
        "unsupported_operation",
        `This endpoint does not implement "${envelope.operation}".`,
      ),
    );

  const { catalog, history } = definition;
  // Bound, so implementations written as methods keep their `this`.
  const getSubscription = definition.subscriptions?.get?.bind(definition.subscriptions);
  const cancelSubscription = definition.subscriptions?.cancel?.bind(definition.subscriptions);
  const refundTransaction = definition.transactions?.refund?.bind(definition.transactions);

  return Match.value(envelope.operation).pipe(
    Match.when("describe", () => {
      const result: DescribeResult = {
        operations,
        protocolVersion: PROVIDER_PROTOCOL_VERSION,
        sdk: { name: SDK_NAME, version: SDK_VERSION },
        source: definition.source,
      };
      return Promise.resolve({ body: { id: envelope.id, result }, status: 200 });
    }),
    Match.when("catalog.list", () =>
      catalog
        ? runOperation(
            envelope,
            CatalogListInput,
            (input, context) => catalog.list(input, context),
            () => CatalogListResult,
          )
        : unsupported(),
    ),
    Match.when("history.list", () =>
      history
        ? runOperation(
            envelope,
            HistoryListInput,
            (input, context) => history.list(input, context),
            (input) =>
              input.kind === "subscriptions" ? SubscriptionHistoryResult : TransactionHistoryResult,
          )
        : unsupported(),
    ),
    Match.when("subscription.get", () =>
      getSubscription
        ? runOperation(envelope, SubscriptionGetInput, getSubscription, () => SubscriptionGetResult)
        : unsupported(),
    ),
    Match.when("subscription.cancel", () =>
      cancelSubscription
        ? runOperation(
            envelope,
            SubscriptionCancelInput,
            cancelSubscription,
            () => SubscriptionCancelResult,
          )
        : unsupported(),
    ),
    Match.when("transaction.refund", () =>
      refundTransaction
        ? runOperation(
            envelope,
            TransactionRefundInput,
            refundTransaction,
            () => TransactionRefundResult,
          )
        : unsupported(),
    ),
    Match.orElse(unsupported),
  );
};

const testInput = (request: ProviderTestRequest): unknown =>
  Match.value(request).pipe(
    Match.when({ operation: "describe" }, (describe) => describe.input ?? {}),
    Match.when({ operation: "catalog.list" }, ({ input }) =>
      Schema.encodeSync(Schema.toCodecJson(CatalogListInput))(input),
    ),
    Match.when({ operation: "history.list" }, ({ input }) =>
      Schema.encodeSync(Schema.toCodecJson(HistoryListInput))(input),
    ),
    Match.when({ operation: "subscription.get" }, ({ input }) =>
      Schema.encodeSync(Schema.toCodecJson(SubscriptionGetInput))(input),
    ),
    Match.when({ operation: "subscription.cancel" }, ({ input }) =>
      Schema.encodeSync(Schema.toCodecJson(SubscriptionCancelInput))(input),
    ),
    Match.when({ operation: "transaction.refund" }, ({ input }) =>
      Schema.encodeSync(Schema.toCodecJson(TransactionRefundInput))(input),
    ),
    Match.exhaustive,
  );

/**
 * Defines a payment source's endpoint: the operations Voidhash calls to import
 * the source's catalog and history, to refresh a subscription, and to cancel
 * subscriptions and refund charges at the source. The returned handler verifies
 * each request's signature, answers `describe` itself, checks the input, runs
 * your operation, and checks its result before replying.
 *
 * ```ts
 * import { defineProvider, ProviderError } from "@voidhash/node/providers";
 *
 * export const paddle = defineProvider({
 *   source: "paddle",
 *   signingSecret: process.env.VOIDHASH_PROVIDER_SECRET!,
 *   catalog: {
 *     async list({ cursor }) {
 *       const page = await listPrices(cursor);
 *       return {
 *         items: page.prices.map((price) => ({ key: price.id, name: price.name, kind: "subscription" })),
 *         nextCursor: page.next,
 *       };
 *     },
 *   },
 *   subscriptions: {
 *     async get({ id }) {
 *       const subscription = await findSubscription(id);
 *       return { subscription: subscription ? toVoidhash(subscription) : null };
 *     },
 *   },
 * });
 *
 * // app/voidhash/provider/route.ts
 * export const POST = paddle.handler;
 * ```
 */
export const defineProvider = (definition: ProviderDefinition): VoidhashProvider => {
  const operations = implementedOperations(definition);

  const handle = async (request: ProviderHttpRequest): Promise<ProviderHttpResponse> => {
    if (!isSignedRequest(definition, request)) {
      return failure(
        null,
        "invalid_signature",
        "The request signature is missing, wrong, or outside the accepted time window.",
      );
    }

    const body = decodeJson(request.body);

    if (Result.isFailure(body)) {
      return failure(null, "invalid_request", "The request body is not valid JSON.");
    }

    const id =
      P.isObject(body.success) && "id" in body.success && P.isString(body.success.id)
        ? body.success.id
        : null;
    const envelope = decodeEnvelope(body.success);

    if (Result.isFailure(envelope)) {
      return failure(id, "invalid_request", `Invalid request: ${envelope.failure.message}`);
    }

    if (envelope.success.source !== definition.source) {
      return failure(
        id,
        "invalid_request",
        `This endpoint serves the source "${definition.source}", not "${envelope.success.source}".`,
      );
    }

    return answer(definition, operations, envelope.success);
  };

  return {
    handle,
    handler: async (request) => {
      const response = await handle({ body: await request.text(), headers: request.headers });
      return new Response(encodeJson(response.body), {
        headers: { "content-type": "application/json" },
        status: response.status,
      });
    },
    operations,
    source: definition.source,
    test: async (request) => {
      const timestamp = String(Math.floor(DateTime.toEpochMillis(currentUtc()) / 1000));
      const body = encodeJson({
        environment: request.environment ?? "test",
        id: request.requestId ?? "preq_test",
        input: testInput(request),
        operation: request.operation,
        protocolVersion: PROVIDER_PROTOCOL_VERSION,
        source: definition.source,
      });
      const response = await handle({
        body,
        headers: {
          "content-type": "application/json",
          [PROVIDER_SIGNATURE_HEADER]: computeSignature(body, timestamp, definition.signingSecret),
          [PROVIDER_TIMESTAMP_HEADER]: timestamp,
        },
      });
      // Round-trip through JSON so the test sees exactly what Voidhash would.
      return { body: decodeResponse(encodeJson(response.body)), status: response.status };
    },
  };
};

/** The incoming request of `node:http`, Express, Fastify and similar servers. */
export interface NodeProviderRequest extends AsyncIterable<unknown> {
  readonly headers: Readonly<Record<string, string | ReadonlyArray<string> | undefined>>;
  /** Set by a raw body parser such as `express.raw()`; otherwise the stream is read. */
  readonly body?: unknown;
}

/** The outgoing response of `node:http`, Express and similar servers. */
export interface NodeProviderResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body: string): unknown;
}

/** The raw body, or `None` when a JSON parser already replaced it with an object. */
const readNodeBody = async (request: NodeProviderRequest): Promise<Option.Option<string>> => {
  if (P.isString(request.body)) {
    return Option.some(request.body);
  }

  if (request.body instanceof Uint8Array) {
    return Option.some(new TextDecoder().decode(request.body));
  }

  if (request.body !== undefined) {
    return Option.none();
  }

  const chunks: Array<Uint8Array> = [];
  // oxlint-disable-next-line effect/imperative-loops -- a Node request is an async iterable of chunks; there is no Arr equivalent for draining it.
  for await (const chunk of request) {
    chunks.push(chunk instanceof Uint8Array ? chunk : utf8ToBytes(String(chunk)));
  }
  return Option.some(new TextDecoder().decode(concatBytes(...chunks)));
};

/**
 * Adapts a provider to `node:http`-style servers such as Express. The
 * signature covers the exact bytes Voidhash sent, so mount it before any JSON
 * body parser, or behind a raw one:
 *
 * ```ts
 * app.post("/voidhash/provider", express.raw({ type: "application/json" }), toNodeHandler(paddle));
 * ```
 */
export const toNodeHandler =
  (provider: VoidhashProvider) =>
  async (request: NodeProviderRequest, response: NodeProviderResponse): Promise<void> => {
    const body = await readNodeBody(request);
    const result = Option.isSome(body)
      ? await provider.handle({ body: body.value, headers: request.headers })
      : failure(
          null,
          "invalid_request",
          "The request body was parsed before it reached the provider handler; mount the handler behind a raw body parser such as express.raw().",
        );

    response.statusCode = result.status;
    response.setHeader("content-type", "application/json");
    response.end(encodeJson(result.body));
  };
