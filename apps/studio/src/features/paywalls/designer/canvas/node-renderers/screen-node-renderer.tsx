import type { ScreenNodeData } from '@voidhash/mimic-schema';
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
              style={{
                width: node.style.width,
                height: node.style.height,
                boxSizing: 'border-box',
                overflow: 'hidden',
                backgroundColor: node.style.backgroundEnabled
                  ? node.style.backgroundColor
                  : 'transparent'
              }}
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
