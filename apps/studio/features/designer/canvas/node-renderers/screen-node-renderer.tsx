import type { ScreenNodeData } from '../../state/schema';
import { Selectable } from '../helpers/selectable';

export function ScreenNodeRenderer({ node }: { node: ScreenNodeData }) {
  return (
    <pixiContainer x={node.x} y={node.y}>
      <Selectable height={node.height} nodeId={node.id} width={node.width}>
        {() => (
          <pixiGraphics
            draw={(graphics) => {
              graphics.clear();
              graphics.setFillStyle({ color: 0xff_ff_ff, alpha: 1 });
              graphics.rect(0, 0, node.width, node.height);
              graphics.fill();
            }}
          />
        )}
      </Selectable>
    </pixiContainer>
  );
}
