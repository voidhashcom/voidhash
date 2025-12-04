'use client';

import type { ScreenNodeData } from '@voidhash/dff';
import { useDesignerActions } from '../../state/designer-store';
import { LayoutSection } from './sections/layout-section';

const DISPATCH_ACTION = 'updateScreenNode';
export function ScreenPanel({ node }: { node: ScreenNodeData }) {
  const dispatch = useDesignerActions();
  return (
    // <>
    <LayoutSection
      direction="column"
      node={node}
      onNodeChange={(updatedNode) =>
        dispatch(DISPATCH_ACTION, { ...node, ...updatedNode })
      }
    />
    // </>
  );
}
