import * as Option from "effect/Option";
import * as P from "effect/Predicate";

type HistoryMethod = "pushState" | "replaceState";

/**
 * Calls `onNavigate` after every client-side navigation that changes the
 * path or query: `history.pushState`, `history.replaceState` and back/forward
 * (`popstate`), telling it whether the path changed. Hash-only changes are
 * ignored. Returns the cleanup.
 *
 * The check runs in a later task, not inside the History call: routers update
 * `document.title` and the rendered page after they push the new URL, and the
 * page view should describe the page that was navigated to.
 *
 * The History methods are wrapped rather than replaced: the page's own call
 * always runs first and unchanged, and a failure in `onNavigate` never
 * reaches it. On cleanup the wrapper is removed while it is still the
 * installed one. When something wrapped it after us, our wrapper stays in that
 * chain, so it turns into a plain pass-through instead.
 */
export const observeNavigation = (
  onNavigate: (change: { readonly pathChanged: boolean }) => void,
): (() => void) => {
  if (P.isUndefined(globalThis.window) || P.isUndefined(globalThis.history)) return () => {};

  let isActive = true;
  let lastPath = window.location.pathname;
  let lastSearch = window.location.search;

  // Analytics must never break the page's navigation, so a failure is dropped.
  const check = Option.liftThrowable(() => {
    if (!isActive) return;
    const { pathname, search } = window.location;
    if (pathname === lastPath && search === lastSearch) return;
    const pathChanged = pathname !== lastPath;
    lastPath = pathname;
    lastSearch = search;
    onNavigate({ pathChanged });
  });
  const scheduleCheck = Option.liftThrowable(() => {
    if (isActive) setTimeout(check, 0);
  });
  const onPopState = () => {
    scheduleCheck();
  };

  const wrap = (method: HistoryMethod) => {
    const original = history[method];
    const wrapped: History[HistoryMethod] = function wrappedHistoryMethod(this: History, ...args) {
      const result = original.apply(this, args);
      scheduleCheck();
      return result;
    };
    history[method] = wrapped;
    return () => {
      if (history[method] === wrapped) history[method] = original;
    };
  };

  const restorePush = wrap("pushState");
  const restoreReplace = wrap("replaceState");
  window.addEventListener("popstate", onPopState);

  return () => {
    isActive = false;
    restorePush();
    restoreReplace();
    window.removeEventListener("popstate", onPopState);
  };
};
