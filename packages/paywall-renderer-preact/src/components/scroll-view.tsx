import type { ScrollViewSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { buildScrollViewStyles } from "@voidhash/paywall-renderer-web-core";
import type { ComponentChildren } from "preact";

import { useInteractions } from "../hooks/use-interactions";
import { useLocalizedBackgroundImage } from "../hooks/use-localized-background";
import { useResolvedStyle } from "../hooks/use-resolved-style";

interface ScrollViewProps {
  node: ScrollViewSnapshotNode;
  children: ComponentChildren;
}

export function ScrollView({ node, children }: ScrollViewProps) {
  const style = useResolvedStyle(node.id, node.data.style, node.data.states);
  const onClick = useInteractions(node.id, node.data.interactions, node.data.states);
  // Substitute the locale-specific background image ONLY when a real override
  // exists for the active locale — otherwise the state-resolved style passes
  // through untouched.
  const localizedBackground = useLocalizedBackgroundImage(node.data);
  const styles = buildScrollViewStyles(
    localizedBackground === node.data.style.backgroundImage
      ? style
      : { ...style, backgroundImage: localizedBackground },
    {
      horizontal: node.data.horizontal,
      showsScrollIndicator: node.data.showsScrollIndicator,
    },
  );

  return (
    <div
      data-node-id={node.id}
      onClick={onClick}
      style={{
        ...(styles as Record<string, string | number>),
        ...(onClick ? { cursor: "pointer" } : {}),
      }}
    >
      {children as unknown as null}
    </div>
  );
}
