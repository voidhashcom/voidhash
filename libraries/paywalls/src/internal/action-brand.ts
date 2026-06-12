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
