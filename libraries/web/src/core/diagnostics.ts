import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import type { VoidhashDiagnostic } from "../types";
import { EventBusProvider } from "./event-bus";
import { SdkConfiguration } from "./sdk-configuration";

export const makeDiagnostics = Effect.fnUntraced(function* makeDiagnostics() {
  const eventBus = yield* EventBusProvider;
  const config = yield* SdkConfiguration;

  /**
   * Reports a diagnostic to the `onDiagnostic` option and to the `diagnostic`
   * event. Handler exceptions are swallowed so instrumentation can never break
   * the SDK.
   */
  const report = (diagnostic: VoidhashDiagnostic) =>
    Effect.sync(() => {
      // The handler is a host callback that may throw anything. Diagnostics
      // are advisory, so a failing handler is swallowed rather than surfaced;
      // the event bus isolates its own listeners.
      Result.try({ catch: (error) => error, try: () => config.onDiagnostic?.(diagnostic) });
      eventBus.emit("diagnostic", diagnostic);
    });

  return { report };
});

export class Diagnostics extends Context.Service<
  Diagnostics,
  Effect.Success<ReturnType<typeof makeDiagnostics>>
>()("web-voidhash/Diagnostics") {}
