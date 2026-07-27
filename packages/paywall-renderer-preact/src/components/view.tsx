import type { ViewSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { buildViewStyles } from "@voidhash/paywall-renderer-web-core";
import type { ComponentChildren } from "preact";

import { useInteractions } from "../hooks/use-interactions";
import { useLocalizedBackgroundImage } from "../hooks/use-localized-background";
import { useResolvedStyle } from "../hooks/use-resolved-style";

interface ViewProps {
  node: ViewSnapshotNode;
  children: ComponentChildren;
}

export function View({ node, children }: ViewProps) {
  const style = useResolvedStyle(node.id, node.data.style, node.data.states);
  const onClick = useInteractions(node.id, node.data.interactions, node.data.states);
  // Substitute the locale-specific background image ONLY when a real override
  // exists for the active locale — otherwise the state-resolved style passes
  // through untouched.
  const localizedBackground = useLocalizedBackgroundImage(node.data);
  const styles = buildViewStyles(
    localizedBackground === node.data.style.backgroundImage
      ? style
      : { ...style, backgroundImage: localizedBackground },
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
