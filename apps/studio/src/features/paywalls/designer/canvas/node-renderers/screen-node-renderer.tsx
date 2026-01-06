import type { ScreenNodeData } from '@voidhash/mimic-schema';
import { buildScreenContainerStyles } from '@voidhash/paywall-renderer-web-core';
import { Selectable } from '../helpers/selectable';
import { FlexLayoutRenderer } from './layouts/flex-layout-renderer';

export function ScreenNodeRenderer({
  node,
  children,
  ref
}: {
  node: ScreenNodeData;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="absolute"
      ref={ref}
      style={{ left: node.style.x, top: node.style.y }}
    >
      <Selectable nodeId={node.id}>
        {(selectableProps) => (
          <>
            <div
              style={
                buildScreenContainerStyles(node.style) as React.CSSProperties
              }
              {...selectableProps}
            >
              <FlexLayoutRenderer
                initialStyle={{
                  width: node.style.width,
                  height: node.style.height
                }}
                style={{
                  ...node.style,
                  borderRadiusTopLeft: 0,
                  borderRadiusTopRight: 0,
                  borderRadiusBottomRight: 0,
                  borderRadiusBottomLeft: 0
                }}
              >
                {children}
              </FlexLayoutRenderer>
            </div>
          </>
        )}
      </Selectable>
    </div>
  );
}
