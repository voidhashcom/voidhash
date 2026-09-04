import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Option from "effect/Option";

import { Diagnostics, DIAGNOSTIC_CODES } from "../diagnostics/diagnostics";

/**
 * How long a rejected key keeps outbound traffic paused before one request is
 * allowed through again. A `401` is usually a misconfiguration, but it is also
 * what a briefly misbehaving edge returns, so the pause has to be liftable.
 */
export const AUTH_PAUSE_PROBE_INTERVAL_MS = 60_000;

const make = Effect.fn("makeAuthGate")(function* effect() {
  const diagnostics = yield* Diagnostics;
  const pausedAt = MutableRef.make(Option.none<number>());
  const probeStartedAt = MutableRef.make(Option.none<number>());
  const surfaced = MutableRef.make(false);

  /**
   * Records a rejected publishable key. Outbound traffic pauses, but nothing
   * queued is dropped: a misconfigured key must cost delivery latency, not a
   * user's events.
   */
  const pause = Effect.fn("AuthGate.pause")(function* (operation: string, httpStatus: number) {
    const alreadyPaused = Option.isSome(MutableRef.get(pausedAt));
    const now = yield* Clock.currentTimeMillis;
    if (alreadyPaused) {
      if (Option.isSome(MutableRef.get(probeStartedAt))) {
        MutableRef.set(probeStartedAt, Option.some(now));
      }
      return;
    }
    MutableRef.set(pausedAt, Option.some(now));
    yield* diagnostics.emit({
      code: DIAGNOSTIC_CODES.AUTHENTICATION_FAILED,
      httpStatus,
      kind: "auth",
      message:
        "The publishable key was rejected. Outbound requests are paused; queued data is kept.",
      operation,
      retryable: false,
    });
  });

  const isPaused = () => Option.isSome(MutableRef.get(pausedAt));

  /**
   * Claims the one recovery probe available after
   * {@link AUTH_PAUSE_PROBE_INTERVAL_MS}. The pause stays active while the
   * probe runs, so concurrent requests remain blocked until its caller reports
   * the outcome through `completeProbe`.
   */
  const probe = Effect.fn("AuthGate.probe")(function* () {
    const since = MutableRef.get(pausedAt);
    if (Option.isNone(since)) return false;
    const now = yield* Clock.currentTimeMillis;
    const started = MutableRef.get(probeStartedAt);
    if (Option.isSome(started) && now - started.value < AUTH_PAUSE_PROBE_INTERVAL_MS) {
      return false;
    }
    const eligibleAt = Option.getOrElse(started, () => since.value);
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
        MutableRef.set(surfaced, false);
        return;
      }
      MutableRef.set(probeStartedAt, Option.some(yield* Clock.currentTimeMillis));
    });

  /**
   * Reports whether the authentication failure still has to be surfaced to the
   * host, and marks it surfaced. Reads with no cached value to fall back on
   * use this to fail loudly exactly once, so a wrong key in development is
   * impossible to miss.
   */
  const takeUnsurfaced = () => {
    if (Option.isNone(MutableRef.get(pausedAt)) || MutableRef.get(surfaced)) return false;
    MutableRef.set(surfaced, true);
    return true;
  };

  /** Clears the pause. Called when the host reconfigures the SDK. */
  const resume = () =>
    Effect.sync(() => {
      MutableRef.set(pausedAt, Option.none());
      MutableRef.set(probeStartedAt, Option.none());
      MutableRef.set(surfaced, false);
    });

  return { completeProbe, isPaused, pause, probe, resume, takeUnsurfaced } as const;
});

/**
 * Process-wide gate for `401`/`403`. Authentication failures never trip the
 * circuit breaker (the host is fine, the credential is not) and never drop
 * queued data.
 */
export class AuthGate extends Context.Service<AuthGate, Effect.Success<ReturnType<typeof make>>>()(
  "rn-voidhash/AuthGate",
) {
  static readonly layer = Layer.effect(AuthGate, make());
}
