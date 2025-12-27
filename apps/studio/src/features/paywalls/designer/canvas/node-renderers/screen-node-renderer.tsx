import type { ScreenNodeData } from '../../state/schema';
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
      style={{ left: node.data.style.x, top: node.data.style.y }}
    >
      <Selectable nodeId={node.id}>
        {(selectableProps) => (
          <>
            <div
              style={{
                width: node.data.style.width,
                height: node.data.style.height,
                boxSizing: 'border-box',
                overflow: 'hidden',
                backgroundColor: node.data.style.backgroundEnabled
                  ? node.data.style.backgroundColor
                  : 'transparent'
              }}
              {...selectableProps}
            >
              <FlexLayoutRenderer
                initialStyle={{
                  width: node.data.style.width,
                  height: node.data.style.height
                }}
                style={{
                  ...node.data.style,
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
