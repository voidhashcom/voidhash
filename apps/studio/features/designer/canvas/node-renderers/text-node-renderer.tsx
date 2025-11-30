import type { TextNodeData } from '../../state/schema';
import { Selectable } from '../helpers/selectable';

export function TextNodeRenderer({ node }: { node: TextNodeData }) {
  return (
    <Selectable nodeId={node.id}>
      {() => (
        <div
          style={{
            fontSize: node.fontSize,
            color: node.color,
            fontWeight: node.fontWeight,
            textAlign: node.textAlign,
            lineHeight: node.lineHeight,
            letterSpacing: node.letterSpacing
          }}
        >
          {node.text}
        </div>
      )}
    </Selectable>
  );
}
