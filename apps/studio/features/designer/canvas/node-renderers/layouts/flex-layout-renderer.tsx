import type { FlexNodeData } from '../../../state/schema';

type FlexLayoutRendererProps = Omit<
  FlexNodeData,
  'type' | 'id' | 'name' | 'parent'
> & {
  children: React.ReactNode;
  initialStyle?: React.CSSProperties;
  ref?: React.RefObject<HTMLDivElement | null>;
};

export function FlexLayoutRenderer({
  children,
  ref,
  gap = 0,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  flexDirection,
  justifyContent,
  alignItems,
  backgroundColor,
  initialStyle = {}
}: FlexLayoutRendererProps) {
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection,
        gap,
        justifyContent,
        alignItems,
        paddingTop: paddingTop ?? 0,
        paddingRight: paddingRight ?? 0,
        paddingBottom: paddingBottom ?? 0,
        paddingLeft: paddingLeft ?? 0,
        backgroundColor: backgroundColor ?? undefined,
        boxSizing: 'border-box',
        ...initialStyle
      }}
    >
      {children}
    </div>
  );
}
