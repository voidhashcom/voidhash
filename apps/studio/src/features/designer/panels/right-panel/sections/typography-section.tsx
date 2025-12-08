'use client';

import type { FontWeight, TextAlign } from '@voidhash/dff';
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle
} from '../../core/components/panel-section';

interface TypographySectionProps {
  fontSize: number;
  color: string;
  fontWeight: FontWeight;
  textAlign: TextAlign;
  lineHeight: number;
  letterSpacing: number;
  onFontSizeChange: (value: number) => void;
  onColorChange: (value: string) => void;
  onFontWeightChange: (value: FontWeight) => void;
  onTextAlignChange: (value: TextAlign) => void;
  onLineHeightChange: (value: number) => void;
  onLetterSpacingChange: (value: number) => void;
}

const FONT_WEIGHT_OPTIONS: Array<{ value: FontWeight; label: string }> = [
  { value: '100', label: 'Thin' },
  { value: '200', label: 'Extra Light' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' }
];

const TEXT_ALIGN_OPTIONS: Array<{ value: TextAlign; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' }
];

export function TypographySection({
  fontSize,
  color,
  fontWeight,
  textAlign,
  lineHeight,
  letterSpacing,
  onFontSizeChange,
  onColorChange,
  onFontWeightChange,
  onTextAlignChange,
  onLineHeightChange,
  onLetterSpacingChange
}: TypographySectionProps) {
  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Typography</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <PanelSubSection>
          <PanelSubSectionTitle>Color</PanelSubSectionTitle>
          {/* <PanelSubSectionContent>
            <ColorInput onChange={onColorChange} value={color} />
          </PanelSubSectionContent> */}
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Font Size</PanelSubSectionTitle>
          {/* <PanelSubSectionContent>
            <NumberInput
              min={1}
              onChange={onFontSizeChange}
              suffix="px"
              value={fontSize}
            />
          </PanelSubSectionContent> */}
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Font Weight</PanelSubSectionTitle>
          {/* <PanelSubSectionContent>
            <SelectInput
              onChange={onFontWeightChange}
              options={FONT_WEIGHT_OPTIONS}
              value={fontWeight}
            />
          </PanelSubSectionContent> */}
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Text Align</PanelSubSectionTitle>
          {/* <PanelSubSectionContent>
            <SelectInput
              onChange={onTextAlignChange}
              options={TEXT_ALIGN_OPTIONS}
              value={textAlign}
            />
          </PanelSubSectionContent> */}
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Line Height</PanelSubSectionTitle>
          {/* <PanelSubSectionContent>
            <NumberInput
              min={0.5}
              onChange={onLineHeightChange}
              step={0.1}
              value={lineHeight}
            />
          </PanelSubSectionContent> */}
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Letter Spacing</PanelSubSectionTitle>
          {/* <PanelSubSectionContent>
            <NumberInput
              onChange={onLetterSpacingChange}
              step={0.1}
              suffix="px"
              value={letterSpacing}
            />
          </PanelSubSectionContent> */}
        </PanelSubSection>
      </PanelSectionContent>
    </PanelSection>
  );
}
