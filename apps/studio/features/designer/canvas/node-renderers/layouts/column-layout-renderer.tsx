import type { AlignItems, JustifyContent, Padding } from '../../../state/schema';

interface ColumnLayoutRendererProps {
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
  gap?: number;
  padding?: Padding;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  backgroundColor?: string | null;
}

export function ColumnLayoutRenderer({
  children,
  ref,
  gap = 0,
  padding,
  justifyContent = 'flex-start',
  alignItems = 'stretch',
  backgroundColor
}: ColumnLayoutRendererProps) {
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        justifyContent,
        alignItems,
        paddingTop: padding?.top ?? 0,
        paddingRight: padding?.right ?? 0,
        paddingBottom: padding?.bottom ?? 0,
        paddingLeft: padding?.left ?? 0,
        backgroundColor: backgroundColor ?? undefined,
        boxSizing: 'border-box'
      }}
    >
      {children}
    </div>
  );
}
