import type { RowNodeData } from '../../state/schema';
import { Selectable } from '../helpers/selectable';
import { RowLayoutRenderer } from './layouts/row-layout-renderer';

export function RowNodeRenderer({
  node,
  children,
  ref
}: {
  node: RowNodeData;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Selectable nodeId={node.id}>
      {() => (
        <RowLayoutRenderer
          alignItems={node.alignItems}
          backgroundColor={node.backgroundColor}
          gap={node.gap}
          justifyContent={node.justifyContent}
          padding={node.padding}
          ref={ref}
        >
          {children}
        </RowLayoutRenderer>
      )}
    </Selectable>
  );
}
