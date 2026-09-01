import type { ScreenSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import {
  buildScreenContainerStyles,
  buildScreenLayoutStyles,
} from "@voidhash/paywall-renderer-web-core";
import { h, type ComponentChildren } from "preact";

import { useLocalizedBackgroundImage } from "../hooks/use-localized-background";
import { useResolvedStyle } from "../hooks/use-resolved-style";

interface ScreenProps {
  node: ScreenSnapshotNode;
  children: ComponentChildren;
}

export function Screen({ node, children }: ScreenProps) {
  const style = useResolvedStyle(node.id, node.data.style, node.data.states);
  // The background lives on the container; substitute the locale override only
  // when one applies so default-locale output stays byte-identical.
  const localizedBackground = useLocalizedBackgroundImage(node.data);
  const containerStyles = buildScreenContainerStyles(
    localizedBackground === node.data.style.backgroundImage
      ? style
      : { ...style, backgroundImage: localizedBackground },
  );
  const layoutStyles = buildScreenLayoutStyles(style);
  return h(
    "div",
    { "data-node-id": node.id, style: containerStyles },
    h("div", { style: layoutStyles }, children),
  );
}
