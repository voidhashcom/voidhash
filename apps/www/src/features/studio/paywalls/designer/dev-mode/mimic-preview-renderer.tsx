"use client";

import { Button } from "@voidhash/ui";
import {
  buildViewStyles,
  buildPathStyles,
  buildScreenContainerStyles,
  buildShapeContainerStyles,
  buildTextStyles,
  type SnapshotNode,
} from "@voidhash/paywall-renderer-web-core";
import { MoonIcon, SunIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

type PreviewBackground = "dark" | "light" | "checkerboard";

interface MimicPreviewRendererProps {
  node: SnapshotNode;
  maxWidth?: number;
  maxHeight?: number;
}

function PreviewNodeRenderer({ node }: { node: SnapshotNode }) {
  const children = node.children;

  if (node.type === "root" || node.type === "component") {
    return (
      <>
        {children.map((child) => (
          <PreviewNodeRenderer key={child.id} node={child} />
        ))}
      </>
    );
  }

  if (node.type === "screen") {
    const containerStyles = buildScreenContainerStyles(node.data.style) as CSSProperties;

    return (
      <div
        style={{
          ...containerStyles,
          width: node.data.style.width,
          height: node.data.style.height,
          position: "relative",
        }}
      >
        <div
          style={{
            ...(buildViewStyles({
              ...node.data.style,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderBottomLeftRadius: 0,
            }) as CSSProperties),
            width: "100%",
            height: "100%",
          }}
        >
          {children.map((child) => (
            <PreviewNodeRenderer key={child.id} node={child} />
          ))}
        </div>
      </div>
    );
  }

  if (node.type === "view") {
    const viewStyles = buildViewStyles(node.data.style) as CSSProperties;

    return (
      <div style={viewStyles}>
        {children.map((child) => (
          <PreviewNodeRenderer key={child.id} node={child} />
        ))}
      </div>
    );
  }

  if (node.type === "text") {
    const textStyles = buildTextStyles(node.data.style) as CSSProperties;

    return <div style={textStyles}>{node.data.text}</div>;
  }

  if (node.type === "shape") {
    const containerStyles = buildShapeContainerStyles(node.data.style) as CSSProperties;
    const viewBox = node.data.viewBox;
    const viewBoxString = `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;

    return (
      <div style={containerStyles}>
        <svg
          height="100%"
          preserveAspectRatio={node.data.style.preserveAspectRatio}
          style={{ display: "block" }}
          viewBox={viewBoxString}
          width="100%"
        >
          {children.map((child) => (
            <PreviewNodeRenderer key={child.id} node={child} />
          ))}
        </svg>
      </div>
    );
  }

  if (node.type === "path") {
    const pathStyles = buildPathStyles(node.data.style);

    return (
      <path
        d={node.data.d}
        fill={pathStyles.fill}
        fillOpacity={pathStyles.fillOpacity}
        fillRule={pathStyles.fillRule}
        opacity={pathStyles.opacity}
        stroke={pathStyles.stroke}
        strokeLinecap={pathStyles.strokeLinecap}
        strokeLinejoin={pathStyles.strokeLinejoin}
        strokeOpacity={pathStyles.strokeOpacity}
        strokeWidth={pathStyles.strokeWidth}
        transform={node.data.transform}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  return null;
}

const BACKGROUND_STYLES: Record<PreviewBackground, CSSProperties> = {
  dark: { backgroundColor: "#1a1a1a" },
  light: { backgroundColor: "#f5f5f5" },
  checkerboard: {
    backgroundImage: `
			linear-gradient(45deg, #ccc 25%, transparent 25%),
			linear-gradient(-45deg, #ccc 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #ccc 75%),
			linear-gradient(-45deg, transparent 75%, #ccc 75%)
		`,
    backgroundSize: "16px 16px",
    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
    backgroundColor: "#fff",
  },
};

function BackgroundIcon({ background }: { background: PreviewBackground }) {
  if (background === "dark") {
    return <MoonIcon className="size-3" />;
  }
  if (background === "light") {
    return <SunIcon className="size-3" />;
  }
  return (
    <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
      <rect x="0" y="0" width="8" height="8" opacity="0.3" />
      <rect x="8" y="8" width="8" height="8" opacity="0.3" />
    </svg>
  );
}

export function MimicPreviewRenderer({
  node,
  maxWidth = 260,
  maxHeight = 180,
}: MimicPreviewRendererProps) {
  const [background, setBackground] = useState<PreviewBackground>("dark");

  const cycleBackground = () => {
    setBackground((prev) => {
      if (prev === "dark") return "light";
      if (prev === "light") return "checkerboard";
      return "dark";
    });
  };

  const { scale, contentWidth, contentHeight } = useMemo(() => {
    const style =
      node.type === "screen" || node.type === "view" || node.type === "shape"
        ? node.data.style
        : undefined;

    // Get content dimensions, defaulting to reasonable values
    const width = typeof style?.width === "number" ? style.width : 200;
    const height = typeof style?.height === "number" ? style.height : 100;

    // Calculate scale to fit within max bounds
    const scaleX = maxWidth / width;
    const scaleY = maxHeight / height;
    const computedScale = Math.min(scaleX, scaleY, 1);

    return {
      scale: computedScale,
      contentWidth: width,
      contentHeight: height,
    };
  }, [node, maxWidth, maxHeight]);

  return (
    <div className="mb-4 rounded-md border border-border">
      {/* Background toggle */}
      <div className="flex items-center justify-end border-border border-b px-2 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={cycleBackground}
          title={`Background: ${background}`}
        >
          <BackgroundIcon background={background} />
        </Button>
      </div>
      {/* Preview area */}
      <div
        className="flex items-center justify-center overflow-auto p-4"
        style={{
          ...BACKGROUND_STYLES[background],
          minHeight: 80,
          maxHeight: maxHeight + 32,
        }}
      >
        <div
          style={{
            width: contentWidth * scale,
            height: contentHeight * scale,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: contentWidth,
              height: contentHeight,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <PreviewNodeRenderer node={node} />
          </div>
        </div>
      </div>
    </div>
  );
}
