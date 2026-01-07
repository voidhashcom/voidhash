import type { FlexNodeData } from "@voidhash/mimic-schema";
import { buildFlexStyles } from "@voidhash/paywall-renderer-web-core";

interface FlexLayoutRendererProps {
  style: FlexNodeData["style"];
  children: React.ReactNode;
  initialStyle?: React.CSSProperties;
  ref?: React.RefObject<HTMLDivElement | null>;
}

export function FlexLayoutRenderer({
  children,
  ref,
  style,
  initialStyle = {},
  ...rest
}: FlexLayoutRendererProps) {
  return (
    <div
      ref={ref}
      style={{
        ...(buildFlexStyles(style) as React.CSSProperties),
        ...initialStyle,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
