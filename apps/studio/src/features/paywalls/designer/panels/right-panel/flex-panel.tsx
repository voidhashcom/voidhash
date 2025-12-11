'use client';

import type { FlexNodeData } from '@voidhash/dff';
import { usePaywallDesignerActions } from '../../state/designer-store';
import { BorderRadiusSection } from './sections/border-radius-section';
import { BorderSection } from './sections/border-section';
import { FillSection } from './sections/fill-section';
import { FlexLayoutSection } from './sections/flex-layout-section';
import { VariablesSection } from './sections/variables-section';

const DISPATCH_ACTION = 'updateFlexNode';
export function FlexPanel({ node }: { node: FlexNodeData }) {
  const dispatch = usePaywallDesignerActions();
  return (
    <>
      <VariablesSection
        node={node}
        onNodeChange={(updatedNode) =>
          dispatch(DISPATCH_ACTION, { ...node, ...updatedNode })
        }
      />
      <FlexLayoutSection
        node={node.style}
        onNodeChange={(updatedStyle) =>
          dispatch(DISPATCH_ACTION, {
            ...node,
            style: { ...node.style, ...updatedStyle }
          })
        }
        parentId={node.id}
      />
      <BorderRadiusSection
        node={node.style}
        onNodeChange={(updatedStyle) =>
          dispatch(DISPATCH_ACTION, {
            ...node,
            style: { ...node.style, ...updatedStyle }
          })
        }
      />
      <FillSection
        node={node.style}
        onNodeChange={(updatedStyle) =>
          dispatch(DISPATCH_ACTION, {
            ...node,
            style: { ...node.style, ...updatedStyle }
          })
        }
      />

      <BorderSection
        node={node.style}
        onNodeChange={(updatedStyle) =>
          dispatch(DISPATCH_ACTION, {
            ...node,
            style: { ...node.style, ...updatedStyle }
          })
        }
      />
    </>
  );
}
