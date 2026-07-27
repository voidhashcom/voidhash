import { createContext, type ReactNode, useContext } from "react";

import { useHost } from "./host-context";

/**
 * Carries the children passed to a `defineComponent` instance down to the
 * `<Slot />` placeholder rendered inside that component's template.
 */
const SlotContext = createContext<ReactNode>(null);

export const SlotProvider = SlotContext.Provider;

export interface SlotProps {
  /** Rendered when the component instance was given no children. */
  fallback?: ReactNode;
}

/**
 * Renders the children that were passed to the enclosing reusable component —
 * the paywall equivalent of `props.children`. A component template uses
 * `<Slot />` to mark where consumer-provided content should appear; the tree
 * renderer serializes an empty slot as a `{ type: "slot" }` marker node so the
 * visual editor knows where to mount its own children.
 */
export const Slot = ({ fallback = null }: SlotProps): ReactNode => {
  const children = useContext(SlotContext);
  const HostSlot = useHost().Slot;
  return <HostSlot fallback={fallback}>{children}</HostSlot>;
};
