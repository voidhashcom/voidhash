'use client';

import { useDesignerActions } from '../../state/designer-store';
import type { FontWeight, TextAlign, TextNodeData } from '../../state/schema';
import { TypographySection } from './sections/typography-section';

export function TextPanel({ node }: { node: TextNodeData }) {
  const dispatch = useDesignerActions();

  const handleFontSizeChange = (fontSize: number) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'fontSize',
      value: fontSize
    });
  };

  const handleColorChange = (color: string) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'color',
      value: color
    });
  };

  const handleFontWeightChange = (fontWeight: FontWeight) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'fontWeight',
      value: fontWeight
    });
  };

  const handleTextAlignChange = (textAlign: TextAlign) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'textAlign',
      value: textAlign
    });
  };

  const handleLineHeightChange = (lineHeight: number) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'lineHeight',
      value: lineHeight
    });
  };

  const handleLetterSpacingChange = (letterSpacing: number) => {
    dispatch('updateNodeProperty', {
      id: node.id,
      property: 'letterSpacing',
      value: letterSpacing
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
