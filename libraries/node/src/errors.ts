/* oxlint-disable effect/prefer-option-over-null -- the API error is read by Promise callers too, so absence is plain null and undefined rather than Option. */
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";

export class VoidhashNodeConfigurationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/** A failure the Voidhash API answered with: its error body plus the response's status and request id. */
export interface VoidhashApiError {
  /** The error category, such as `not_found` or `conflict`. */
  readonly type: string;
  /** The specific reason, such as `transaction_conflict`. Branch on this. */
  readonly code: string;
  /** A description for people. It can change; never branch on it. */
  readonly message: string;
  /** The request field the error is about, when there is one. */
  readonly param: string | null;
  /** The HTTP status of the response. */
  readonly status: number;
  /** The response's `request-id` header; include it when contacting support. */
  readonly requestId: string | null;
}

const decodeApiErrorBody = Schema.decodeUnknownOption(
  Schema.Struct({
    error: Schema.Struct({
      type: Schema.String,
      code: Schema.String,
      message: Schema.String,
      param: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  }),
);

/**
 * Reads the Voidhash API error from a rejected call or a failed Effect.
 * Returns `undefined` for anything else, such as a transport failure, an
 * undocumented response, or a configuration error.
 *
 * ```ts
 * try {
 *   await voidhash.paymentSource("ppc_123").charge("txn_123", input);
 * } catch (error) {
 *   if (getVoidhashApiError(error)?.code !== "transaction_conflict") throw error;
 *   // The same id was already recorded with different fields: refund and re-report it.
 * }
 * ```
 */
export const getVoidhashApiError = (error: unknown): VoidhashApiError | undefined => {
  if (!P.hasProperty(error, "data") || !P.hasProperty(error, "response")) {
    return undefined;
  }

  const { response } = error;
  const body = decodeApiErrorBody(error.data);
  if (Option.isNone(body) || !P.hasProperty(response, "status") || !P.isNumber(response.status)) {
    return undefined;
  }

  const requestId =
    P.hasProperty(response, "headers") &&
    P.hasProperty(response.headers, "request-id") &&
    P.isString(response.headers["request-id"])
      ? response.headers["request-id"]
      : null;

  return {
    type: body.value.error.type,
    code: body.value.error.code,
    message: body.value.error.message,
    param: body.value.error.param ?? null,
    status: response.status,
    requestId,
  };
};
