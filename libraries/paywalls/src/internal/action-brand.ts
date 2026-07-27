/**
 * Internal: brands action callbacks produced by `defineComponent` with their
 * declared action name, so a `<Pressable onPress={actions.onSelect}>` can be
 * traced back to the action it fires when serializing preview trees.
 *
 * `Symbol.for` keeps the brand stable even if two copies of the package end up
 * in one process (the symbol lives in the global registry).
 */
const ACTION_NAME_BRAND = Symbol.for("voidhash.paywalls.actionName");

interface BrandedCallback {
  [ACTION_NAME_BRAND]?: string;
}

/** Attaches the declared action name to an action callback. */
export const brandActionCallback = <F extends (...args: never[]) => void>(
  callback: F,
  actionName: string,
): F => {
  (callback as BrandedCallback)[ACTION_NAME_BRAND] = actionName;
  return callback;
};

/**
 * Reads the declared action name off a callback, if it is a branded action
 * callback passed directly (a wrapping arrow function loses the brand).
 */
export const getActionName = (callback: unknown): string | undefined => {
  if (typeof callback !== "function") {
    return;
  }
  return (callback as BrandedCallback)[ACTION_NAME_BRAND];
};

// ── Inline-handler action capture ──────────────────────────────────────────
//
// A direct binding (`onPress={actions.onSelect}`) carries the brand, but the
// idiomatic inline handler (`onPress={() => actions.onSelect({ … })}`) is a
// fresh arrow that does not. To record which action such a handler fires, the
// preview tree host invokes it once inside `withActionRecording`: the first
// branded action callback that runs reports its name here. This runs ONLY in
// the preview-tree renderer (never on a real device), and the branded
// callbacks are side-effect-free in preview (no consumer handler is attached).

let activeRecorder: { name: string | undefined } | null = null;

/**
 * Notifies the active recorder (if any) that a branded action callback with
 * `actionName` was invoked. Called by the branded callbacks in
 * `buildActionCallbacks`. Records only the first name so the outermost action
 * an inline handler fires wins.
 */
export const recordActionInvocation = (actionName: string): void => {
  if (activeRecorder !== null && activeRecorder.name === undefined) {
    activeRecorder.name = actionName;
  }
};

/**
 * Invokes `handler` once with a recording scope active and returns the name of
 * the first branded action it fired, or `undefined`. Nesting is supported (the
 * previous recorder is restored). Handler exceptions are swallowed — a preview
 * probe must never fail the render.
 */
export const captureInlineActionName = (handler: () => void): string | undefined => {
  const previous = activeRecorder;
  const recorder: { name: string | undefined } = { name: undefined };
  activeRecorder = recorder;
  try {
    handler();
  } catch {
    // A probing invocation's side effects/failures are irrelevant to the tree.
  } finally {
    activeRecorder = previous;
  }
  return recorder.name;
};
