import type { ScreenNodeData } from '../../state/schema';
import { Selectable } from '../helpers/selectable';
import { ColumnLayoutRenderer } from './layouts/column-layout-renderer';

export function ScreenNodeRenderer({
  node,
  children
}: {
  node: ScreenNodeData;
  children: React.ReactNode;
}) {
  return (
    <pixiContainer x={node.x} y={node.y}>
      <Selectable nodeId={node.id}>
        {() => (
          <>
            <pixiGraphics
              draw={(graphics) => {
                graphics.clear();
                graphics.setFillStyle({ color: 0xff_ff_ff, alpha: 1 });
                graphics.rect(0, 0, node.width, node.height);
                graphics.fill();
              }}
            />
            <ColumnLayoutRenderer>{children}</ColumnLayoutRenderer>
          </>
        )}
      </Selectable>
    </pixiContainer>
  );
}
