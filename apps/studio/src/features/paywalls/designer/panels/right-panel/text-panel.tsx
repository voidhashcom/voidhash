'use client';

import type { TextNodeData } from '@voidhash/dff';
import { usePaywallDesignerActions } from '../../state/designer-store';
import { TextFillSection } from './sections/text-fill-section';
import { TypographySection } from './sections/typography-section';
import { VariablesSection } from './sections/variables-section';

export function TextPanel({ node }: { node: TextNodeData }) {
  const dispatch = usePaywallDesignerActions();

  const handleNodeChange = (updatedNode: typeof node.style) => {
    dispatch('updateTextNode', {
      ...node,
      style: { ...node.style, ...updatedNode }
    });
  };

  return (
    <>
      <VariablesSection
        node={node}
        onNodeChange={(updatedNode) =>
          dispatch('updateTextNode', { ...node, ...updatedNode })
        }
      />
      <TypographySection node={node.style} onNodeChange={handleNodeChange} />
      <TextFillSection node={node.style} onNodeChange={handleNodeChange} />
    </>
  );
}
