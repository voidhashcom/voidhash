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
    dispatch('updateRowNode', { id: node.id, gap });
  };

  const handlePaddingChange = (padding: Padding) => {
    dispatch('updateRowNode', { id: node.id, padding });
  };

  const handleJustifyContentChange = (justifyContent: JustifyContent) => {
    dispatch('updateRowNode', { id: node.id, justifyContent });
  };

  const handleAlignItemsChange = (alignItems: AlignItems) => {
    dispatch('updateRowNode', { id: node.id, alignItems });
  };

  const handleBackgroundColorChange = (value: string | null) => {
    dispatch('updateRowNode', { id: node.id, backgroundColor: value });
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
