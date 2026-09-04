import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";

import { Diagnostics } from "../diagnostics";

/** How long a pause holds before one request may probe again. */
export const AUTH_PAUSE_PROBE_INTERVAL_MS = 60_000;

const make = Effect.fn("makeAuthGate")(function* effect() {
  const diagnostics = yield* Diagnostics;

  const pausedAt = MutableRef.make(Option.none<number>());
  const probeStartedAt = MutableRef.make(Option.none<number>());

  /** `true` when outbound traffic is paused after an authentication failure. */
  const isPaused = () => Option.isSome(MutableRef.get(pausedAt));

  /**
   * Pauses every outbound plane after a 401/403. Queues are kept on disk and a
   * single `auth` diagnostic is reported per pause, so a misconfigured key is
   * visible instead of silently burning data.
   */
  const pause = (input: { httpStatus: number; operation: string }) =>
    Effect.gen(function* pause() {
      if (Option.isSome(MutableRef.get(pausedAt))) return;
      MutableRef.set(pausedAt, Option.some(yield* Clock.currentTimeMillis));
      yield* diagnostics.report({
        code: "AUTHENTICATION_FAILED",
        httpStatus: input.httpStatus,
        kind: "auth",
        message:
          "Outbound traffic paused after an authentication failure. Queued data is kept on disk.",
        operation: input.operation,
        retryable: false,
      });
    });

  /** Lifts the pause so the next request is attempted again. */
  const resume = () =>
    Effect.sync(() => {
      MutableRef.set(pausedAt, Option.none());
      MutableRef.set(probeStartedAt, Option.none());
    });

  /**
   * Claims one recovery probe after the pause interval. The pause remains in
   * place while that request runs, keeping concurrent outbound work blocked.
   */
  const probe = () =>
    Effect.gen(function* probe() {
      const pausedSince = MutableRef.get(pausedAt);
      if (Option.isNone(pausedSince)) return false;
      const now = yield* Clock.currentTimeMillis;
      const startedAt = MutableRef.get(probeStartedAt);
      if (Option.isSome(startedAt) && now - startedAt.value < AUTH_PAUSE_PROBE_INTERVAL_MS) {
        return false;
      }
      const eligibleAt = Option.getOrElse(startedAt, () => pausedSince.value);
      if (now - eligibleAt < AUTH_PAUSE_PROBE_INTERVAL_MS) return false;
      MutableRef.set(probeStartedAt, Option.some(now));
      return true;
    });

  /** Completes a claimed probe. Success resumes traffic; failure schedules another probe. */
  const completeProbe = (succeeded: boolean) =>
    Effect.gen(function* completeProbe() {
      if (Option.isNone(MutableRef.get(probeStartedAt))) return;
      if (succeeded) {
        MutableRef.set(pausedAt, Option.none());
        MutableRef.set(probeStartedAt, Option.none());
        return;
      }
      MutableRef.set(probeStartedAt, Option.some(yield* Clock.currentTimeMillis));
    });

  return { completeProbe, isPaused, pause, probe, resume };
});

export class AuthGate extends Context.Service<AuthGate, Effect.Success<ReturnType<typeof make>>>()(
  "web-voidhash/AuthGate",
) {
  static Default = Layer.effect(AuthGate, make());
}
