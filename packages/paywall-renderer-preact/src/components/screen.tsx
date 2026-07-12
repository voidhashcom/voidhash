import type { ScreenSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import {
  buildScreenContainerStyles,
  buildScreenLayoutStyles,
} from "@voidhash/paywall-renderer-web-core";
import type { ComponentChildren } from "preact";

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
  return (
    <div data-node-id={node.id} style={containerStyles as Record<string, string | number>}>
      <div style={layoutStyles as Record<string, string | number>}>
        {/* I hate all of this, but it's the only way to get the types to work, probably due to conflicts with Preact and React. */}
        {children as unknown as null}
      </div>
    </div>
  );
}
