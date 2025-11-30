import type { ScreenNodeData } from '../../state/schema';
import { Selectable } from '../helpers/selectable';
import { ColumnLayoutRenderer } from './layouts/column-layout-renderer';

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
    <div className="absolute" ref={ref} style={{ left: node.x, top: node.y }}>
      <Selectable nodeId={node.id}>
        {() => (
          <>
            <div
              style={{
                width: node.width,
                height: node.height,
                backgroundColor: node.backgroundColor,
                paddingTop: node.padding.top + (node.safeArea.top ? 47 : 0),
                paddingRight: node.padding.right,
                paddingBottom:
                  node.padding.bottom + (node.safeArea.bottom ? 34 : 0),
                paddingLeft: node.padding.left,
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}
            >
              <ColumnLayoutRenderer>{children}</ColumnLayoutRenderer>
            </div>
          </>
        )}
      </Selectable>
    </div>
  );
}
