'use client';

import type { FontWeight, TextAlign, TextNodeData } from '@voidhash/dff';
import { useDesignerActions } from '../../state/designer-store';
import { TypographySection } from './sections/typography-section';

export function TextPanel({ node }: { node: TextNodeData }) {
  const dispatch = useDesignerActions();

  const handleFontSizeChange = (fontSize: number) => {
    dispatch('updateTextNode', {
      id: node.id,
      fontSize
    });
  };

  const handleColorChange = (color: string) => {
    dispatch('updateTextNode', {
      id: node.id,
      color
    });
  };

  const handleFontWeightChange = (fontWeight: FontWeight) => {
    dispatch('updateTextNode', {
      id: node.id,
      fontWeight
    });
  };

  const handleTextAlignChange = (textAlign: TextAlign) => {
    dispatch('updateTextNode', {
      id: node.id,
      textAlign
    });
  };

  const handleLineHeightChange = (lineHeight: number) => {
    dispatch('updateTextNode', {
      id: node.id,
      lineHeight
    });
  };

  const handleLetterSpacingChange = (letterSpacing: number) => {
    dispatch('updateTextNode', {
      id: node.id,
      letterSpacing
    });
  };

  return (
    <TypographySection
      color={node.color}
      fontSize={node.fontSize}
      fontWeight={node.fontWeight}
      letterSpacing={node.letterSpacing}
      lineHeight={node.lineHeight}
      onColorChange={handleColorChange}
      onFontSizeChange={handleFontSizeChange}
      onFontWeightChange={handleFontWeightChange}
      onLetterSpacingChange={handleLetterSpacingChange}
      onLineHeightChange={handleLineHeightChange}
      onTextAlignChange={handleTextAlignChange}
      textAlign={node.textAlign}
    />
  );
}
