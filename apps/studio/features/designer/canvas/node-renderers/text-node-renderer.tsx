import type { TextNodeData } from '../../state/schema';
import { Selectable } from '../helpers/selectable';

export function TextNodeRenderer({ node }: { node: TextNodeData }) {
  return (
    <Selectable nodeId={node.id}>{() => <div>{node.text}</div>}</Selectable>
  );
}
