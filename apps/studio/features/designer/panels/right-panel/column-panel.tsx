'use client';

import { useDesignerActions } from '../../state/designer-store';
import type {
  AlignItems,
  ColumnNodeData,
  JustifyContent,
  Padding
} from '../../state/schema';
import { FillSection } from './sections/fill-section';
import { FlexLayoutSection } from './sections/flex-layout-section';

export function ColumnPanel({ node }: { node: ColumnNodeData }) {
  const dispatch = useDesignerActions();

  const handleGapChange = (gap: number) => {
    dispatch('updateColumnNode', { id: node.id, gap });
  };

  const handlePaddingChange = (padding: Padding) => {
    dispatch('updateColumnNode', { id: node.id, padding });
  };

  const handleJustifyContentChange = (justifyContent: JustifyContent) => {
    dispatch('updateColumnNode', { id: node.id, justifyContent });
  };

  const handleAlignItemsChange = (alignItems: AlignItems) => {
    dispatch('updateColumnNode', { id: node.id, alignItems });
  };

  const handleBackgroundColorChange = (value: string | null) => {
    dispatch('updateColumnNode', { id: node.id, backgroundColor: value });
  };

  return (
    <>
      <FlexLayoutSection
        alignItems={node.alignItems}
        direction="column"
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
