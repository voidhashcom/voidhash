import type { ColumnNodeData } from '../../state/schema';
import { Selectable } from '../helpers/selectable';
import { ColumnLayoutRenderer } from './layouts/column-layout-renderer';

export function ColumnNodeRenderer({
  node,
  children,
  ref
}: {
  node: ColumnNodeData;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Selectable nodeId={node.id}>
      {() => (
        <ColumnLayoutRenderer
          alignItems={node.alignItems}
          backgroundColor={node.backgroundColor}
          gap={node.gap}
          justifyContent={node.justifyContent}
          padding={node.padding}
          ref={ref}
        >
          {children}
        </ColumnLayoutRenderer>
      )}
    </Selectable>
  );
}
