"use client";

import {
  buildPreviewNodeStyles,
  previewResizeModeToObjectFit,
  type PreviewNode,
  type PreviewTree,
} from "@voidhash/paywall-renderer-web-core";
import type { ReactNode } from "react";

export interface PreviewTreeRendererProps {
  tree: PreviewTree;
  /** Rendered in place of the tree's `slot` marker (defaults to nothing). */
  renderSlot?: (() => ReactNode) | undefined;
}

function PreviewNodeView({
  node,
  renderSlot,
}: {
  node: PreviewNode;
  renderSlot: (() => ReactNode) | undefined;
}): ReactNode {
  switch (node.type) {
    case "view":
    case "pressable":
    case "scroll":
      return (
        <div style={buildPreviewNodeStyles(node.style, node.type, node.motion)}>
          {node.children.map((child, index) => (
            <PreviewNodeView
              // biome-ignore lint/suspicious/noArrayIndexKey: preview trees are immutable per contentHash+state
              key={index}
              node={child}
              renderSlot={renderSlot}
            />
          ))}
        </div>
      );
    case "text":
      return <div style={buildPreviewNodeStyles(node.style, "text", node.motion)}>{node.text}</div>;
    case "image":
      return (
        <img
          alt=""
          src={node.src}
          style={{
            ...buildPreviewNodeStyles(node.style, "image", node.motion),
            objectFit: previewResizeModeToObjectFit(node.resizeMode),
          }}
        />
      );
    case "slot":
      return renderSlot?.() ?? null;
    case "placeholder":
      return (
        <div className="inline-flex max-w-full items-center self-start truncate rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {node.reason}
        </div>
      );
    default:
      return null;
  }
}

/**
 * Pure presentational recursive renderer over a contract §3 preview tree
 * (trusted, fixture-rendered output of a deployed component). Pressables are
 * inert; the `slot` marker delegates to `renderSlot`. No data fetching, no
 * selection logic — wrapping renderers (canvas node renderer, library
 * thumbnails) add those concerns.
 */
export function PreviewTreeRenderer({ tree, renderSlot }: PreviewTreeRendererProps) {
  return <PreviewNodeView node={tree.root} renderSlot={renderSlot} />;
}
