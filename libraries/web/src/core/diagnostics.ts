import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { VoidhashDiagnostic } from "../types";
import { EventBusProvider } from "./event-bus";
import { SdkConfiguration } from "./sdk-configuration";

const make = Effect.fn("makeDiagnostics")(function* effect() {
  const eventBus = yield* EventBusProvider;
  const config = yield* SdkConfiguration;

  /**
   * Reports a diagnostic to the `onDiagnostic` option and to the `diagnostic`
   * event. Handler exceptions are swallowed so instrumentation can never break
   * the SDK.
   */
  const report = (diagnostic: VoidhashDiagnostic) =>
    Effect.gen(function* report() {
      // Both sinks are host callbacks that may throw anything. Diagnostics are
      // advisory, so a failing handler is swallowed rather than surfaced.
      yield* Effect.ignore(Effect.try(() => config.onDiagnostic?.(diagnostic)));
      yield* Effect.ignore(Effect.try(() => eventBus.emit("diagnostic", diagnostic)));
    });

  return { report };
});

export class Diagnostics extends Context.Service<
  Diagnostics,
  Effect.Success<ReturnType<typeof make>>
>()("web-voidhash/Diagnostics") {
  static Default = Layer.effect(Diagnostics, make());
}
