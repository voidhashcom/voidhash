import React from "react";
import type { Atom, AtomRegistry } from "effect/unstable/reactivity";

interface AtomStore<A> {
  readonly subscribe: (notify: () => void) => () => void;
  readonly snapshot: () => A;
}

// Mirrors the WeakMap caching pattern used by `@effect/atom-react` so the
// `useSyncExternalStore` subscribe/snapshot pair is stable across renders.
const storeRegistry = new WeakMap<
  AtomRegistry.AtomRegistry,
  WeakMap<Atom.Atom<unknown>, AtomStore<unknown>>
>();

function getStore<A>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<A>
): AtomStore<A> {
  let stores = storeRegistry.get(registry);
  if (stores === undefined) {
    stores = new WeakMap();
    storeRegistry.set(registry, stores);
  }

  const cached = stores.get(atom as Atom.Atom<unknown>);
  if (cached !== undefined) {
    return cached as AtomStore<A>;
  }

  const store: AtomStore<A> = {
    subscribe: (notify) => registry.subscribe(atom, notify),
    snapshot: () => registry.get(atom),
  };
  stores.set(atom as Atom.Atom<unknown>, store as AtomStore<unknown>);
  return store;
}

/**
 * Reads the value of an Effect `Atom` and re-renders whenever it changes.
 *
 * Internal binding around `React.useSyncExternalStore`, intentionally scoped
 * to the SDK so we don't pull in `@effect/atom-react` (which targets a newer
 * React peer range than this package currently supports).
 */
export function useAtomValue<A>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<A>
): A {
  const store = getStore(registry, atom);
  const value = React.useSyncExternalStore(store.subscribe, store.snapshot);

  // Atoms are lazy: without an active mount they may be removed from the
  // registry and lose listeners. Mounting on commit keeps the atom alive for
  // the lifetime of the component subscription.
  React.useEffect(() => registry.mount(atom), [registry, atom]);

  return value;
}
