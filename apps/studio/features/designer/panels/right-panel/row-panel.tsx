'use client';

import { useDesignerActions } from '../../state/designer-store';
import type {
  AlignItems,
  JustifyContent,
  Padding,
  RowNodeData
} from '../../state/schema';
import { FillSection } from './sections/fill-section';
import { FlexLayoutSection } from './sections/flex-layout-section';

export function RowPanel({ node }: { node: RowNodeData }) {
  const dispatch = useDesignerActions();

  const handleGapChange = (gap: number) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'gap',
      value: gap
    });
  };

  const handlePaddingChange = (padding: Padding) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'padding',
      value: padding
    });
  };

  const handleJustifyContentChange = (justifyContent: JustifyContent) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'justifyContent',
      value: justifyContent
    });
  };

  const handleAlignItemsChange = (alignItems: AlignItems) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'alignItems',
      value: alignItems
    });
  };

  const handleBackgroundColorChange = (value: string | null) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'backgroundColor',
      value
    });
  };

  return (
    <>
      <FlexLayoutSection
        alignItems={node.alignItems}
        direction="row"
        gap={node.gap}
        justifyContent={node.justifyContent}
        onAlignItemsChange={handleAlignItemsChange}
        onGapChange={handleGapChange}
        onJustifyContentChange={handleJustifyContentChange}
        onPaddingChange={handlePaddingChange}
        padding={node.padding}
      />
      <FillSection
        allowNull
        backgroundColor={node.backgroundColor}
        onBackgroundColorChange={handleBackgroundColorChange}
      />
    </>
  );
}
