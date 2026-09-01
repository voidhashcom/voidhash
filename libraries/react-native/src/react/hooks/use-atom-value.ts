import React from "react";
import type { Atom, AtomRegistry } from "effect/unstable/reactivity";

interface AtomStore<A> {
  readonly subscribe: (notify: () => void) => () => void;
  readonly snapshot: () => A;
}

/**
 * Reads the value of an Effect `Atom` and re-renders whenever it changes.
 *
 * Internal binding around `React.useSyncExternalStore`, intentionally scoped
 * to the SDK so we don't pull in `@effect/atom-react` (which targets a newer
 * React peer range than this package currently supports).
 */
export function useAtomValue<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): A {
  const store = React.useMemo<AtomStore<A>>(
    () => ({
      subscribe: (notify) => registry.subscribe(atom, notify),
      snapshot: () => registry.get(atom),
    }),
    [registry, atom],
  );
  const value = React.useSyncExternalStore(store.subscribe, store.snapshot);

  // Atoms are lazy: without an active mount they may be removed from the
  // registry and lose listeners. Mounting on commit keeps the atom alive for
  // the lifetime of the component subscription.
  React.useEffect(() => registry.mount(atom), [registry, atom]);

  return value;
}
