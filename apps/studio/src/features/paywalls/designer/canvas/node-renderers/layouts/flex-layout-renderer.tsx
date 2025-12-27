import type { FlexNodeData } from '../../../state/schema';

type FlexLayoutRendererProps = {
  style: FlexNodeData['data']['style'];
  children: React.ReactNode;
  initialStyle?: React.CSSProperties;
  ref?: React.RefObject<HTMLDivElement | null>;
};

export function FlexLayoutRenderer({
  children,
  ref,
  style,
  initialStyle = {},
  ...rest
}: FlexLayoutRendererProps) {
  const {
    gap = 0,
    width,
    height,
    flex,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    flexDirection,
    justifyContent,
    alignItems,
    backgroundColor,
    backgroundEnabled,
    borderWidthTop,
    borderWidthRight,
    borderWidthBottom,
    borderWidthLeft,
    borderRadiusTopLeft,
    borderRadiusBottomRight,
    borderRadiusBottomLeft,
    borderRadiusTopRight,
    borderColor,
    borderEnabled,
    alignSelf
  } = style;
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        position: 'relative',
        flexDirection,
        gap,
        justifyContent,
        alignItems,
        paddingTop: paddingTop ?? 0,
        paddingRight: paddingRight ?? 0,
        paddingBottom: paddingBottom ?? 0,
        paddingLeft: paddingLeft ?? 0,
        backgroundColor: backgroundEnabled ? backgroundColor : 'transparent',
        borderTopWidth: borderEnabled ? (borderWidthTop ?? 0) : 0,
        borderRightWidth: borderEnabled ? (borderWidthRight ?? 0) : 0,
        borderBottomWidth: borderEnabled ? (borderWidthBottom ?? 0) : 0,
        borderLeftWidth: borderEnabled ? (borderWidthLeft ?? 0) : 0,
        borderColor,
        borderTopLeftRadius: borderRadiusTopLeft,
        borderTopRightRadius: borderRadiusTopRight,
        borderBottomRightRadius: borderRadiusBottomRight,
        borderBottomLeftRadius: borderRadiusBottomLeft,
        width: width ?? 'auto',
        height: height ?? 'auto',
        alignSelf,
        flex: flex ?? undefined,
        boxSizing: 'border-box',
        ...initialStyle
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
