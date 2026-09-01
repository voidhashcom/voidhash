import type {
  ComponentSnapshotNode,
  VariableReader,
} from "@voidhash/paywall-renderer-web-core";
import { h, render } from "preact";

import { BUILTIN_RENDERERS } from "./renderers";
import { resolveComponentInstanceProps } from "./resolve-props";

/** Options for {@link mountBuiltinPreview}. */
export interface MountBuiltinPreviewOptions {
  /** The instance's `componentSlug` (a `BUILTIN_RENDERERS` key). */
  slug: string;
  /** The instance's document `props` entries (`node.data.props`). */
  props: ComponentSnapshotNode["data"]["props"];
}

const EMPTY_VARIABLES: VariableReader = { get: () => undefined };

/**
 * Mounts a built-in component as a small preact island inside an arbitrary
 * host DOM element — the designer's React edit canvas uses this to render the
 * REAL builtin implementation for a single `componentSource: "builtin"` node.
 * Literal document props resolve like the production renderer's builtin path;
 * variable references resolve against an empty scope (the edit canvas is
 * static) and `actionBindings` are inert. Returns an unmount cleanup, or
 * undefined when the slug has no shipped implementation (callers show their
 * own placeholder). No JSX here: the module must typecheck under consumers'
 * react-jsx configs too, so the vnode is built with `h`.
 */
export function mountBuiltinPreview(
  container: HTMLElement,
  options: MountBuiltinPreviewOptions,
) {
  const renderer = BUILTIN_RENDERERS[options.slug];
  if (!renderer) {
    return undefined;
  }
  const props = resolveComponentInstanceProps(options.props, EMPTY_VARIABLES);
  render(h(renderer, { fireAction: () => {}, props }), container);
  return () => {
    render(null, container);
  };
}
