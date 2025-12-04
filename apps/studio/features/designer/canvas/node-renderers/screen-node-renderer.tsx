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
    <div className="absolute" ref={ref} style={{ left: node.x, top: node.y }}>
      <Selectable nodeId={node.id}>
        {() => (
          <>
            <div
              style={{
                width: node.width,
                height: node.height,
                boxSizing: 'border-box',
                overflow: 'hidden',
                backgroundColor: node.backgroundColor
              }}
            >
              <FlexLayoutRenderer
                {...node}
                initialStyle={{ width: node.width, height: node.height }}
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
