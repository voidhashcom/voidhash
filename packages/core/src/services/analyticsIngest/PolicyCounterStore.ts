/**
 * Abstract port for the capture policy counters (requests/minute, events/day).
 *
 * The application root picks the implementation: a KV-backed live adapter
 * (best-effort `get`+`put`, eventually consistent) or {@link PolicyCounterStore.noop}
 * (always-allow). Projects that need strict limits should use the noop layer
 * plus an upstream Cloudflare WAF rule. The concrete KV adapter lives at the
 * app root so `packages/core` carries no infrastructure dependency.
 *
 * `PlatformRuntime` preserves the guarantee that runtime-backed counter
 * implementations only run inside a configured runtime, without coupling this
 * port to a provider implementation.
 */
import { Context, Effect, Layer, Schema } from "effect";
import type { PlatformRuntime } from "@orbian/sdk/PlatformRuntime";

export class PolicyStoreError extends Schema.TaggedErrorClass<PolicyStoreError>("PolicyStoreError")(
  "PolicyStoreError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.String),
  },
) {}

export interface RequestLimitCheck {
  readonly allowed: boolean;
  readonly retryAfterMs?: number;
}

export interface PolicyCounterStoreShape {
  readonly checkRequestLimit: (input: {
    readonly now: Date;
    readonly projectId: string;
    readonly requestsPerMinute: number | undefined;
  }) => Effect.Effect<RequestLimitCheck, PolicyStoreError, PlatformRuntime>;

  readonly checkEventQuota: (input: {
    readonly now: Date;
    readonly projectId: string;
    readonly quota: number | undefined;
  }) => Effect.Effect<boolean, PolicyStoreError, PlatformRuntime>;
}

export class PolicyCounterStore extends Context.Service<
  PolicyCounterStore,
  PolicyCounterStoreShape
>()("@voidhash/core/PolicyCounterStore") {
  /** Always-allow store — for tests, or apps that defer rate limiting to a WAF. */
  static readonly noop: Layer.Layer<PolicyCounterStore> = Layer.succeed(PolicyCounterStore, {
    checkRequestLimit: () => Effect.succeed({ allowed: true }),
    checkEventQuota: () => Effect.succeed(true),
  });
}
