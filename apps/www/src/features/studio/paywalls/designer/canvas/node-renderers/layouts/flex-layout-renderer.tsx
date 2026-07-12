import type { ViewStyleInput } from "@voidhash/paywall-renderer-web-core";
import { buildViewStyles } from "@voidhash/paywall-renderer-web-core";

interface FlexLayoutRendererProps {
  style: ViewStyleInput;
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
        ...(buildViewStyles(style) as React.CSSProperties),
        ...initialStyle,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
