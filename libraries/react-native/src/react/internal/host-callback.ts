import * as P from "effect/Predicate";

import type { VoidhashClient } from "../../client";

/**
 * Runs a callback the app passed to a hook. An exception it throws, or a
 * promise it returns that rejects, is reported through `onDiagnostic` as
 * `HOST_CALLBACK_FAILED` under `name`, so a bug in app code never leaves a
 * hook stuck or turns a finished purchase or restore into a failure.
 */
export function runHostCallback(
  client: VoidhashClient,
  name: string,
  callback: () => unknown,
): void {
  const report = (callbackError: unknown) =>
    client.internal.reportHostCallbackFailure(name, callbackError);
  // oxlint-disable-next-line effect/avoid-try-catch -- boundary with host application code: the callback is a plain function the app supplies and may throw anything.
  try {
    const returned = callback();
    if (P.isPromiseLike(returned)) returned.then(undefined, report);
  } catch (callbackError) {
    report(callbackError);
  }
}
