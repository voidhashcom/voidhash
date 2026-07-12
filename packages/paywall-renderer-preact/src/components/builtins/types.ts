import type { ComponentChildren } from "preact";

/**
 * Props every built-in component implementation receives: the instance's
 * resolved document props (see `resolveComponentInstanceProps`), a dispatcher
 * for the instance's named `actionBindings` (payload semantics match preview
 * trees: an emitted payload feeds `action-payload` sources), and the node's
 * document children as the slot content.
 */
export interface BuiltinRendererProps {
  props: Record<string, unknown>;
  fireAction: (actionName: string, payload?: Record<string, unknown>) => void;
  children?: ComponentChildren;
}

/** A built-in component implementation shipped with this renderer. */
export type BuiltinRenderer = (props: BuiltinRendererProps) => ComponentChildren;
