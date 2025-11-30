'use client';

import type {
  AlignItems,
  JustifyContent,
  Padding
} from '../../../state/schema';
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle
} from '../../core/components/panel-section';
import { AlignItemsInput, JustifyContentInput } from '../inputs/alignment-input';
import { NumberInput } from '../inputs/number-input';
import { SpacingInput } from '../inputs/spacing-input';

interface FlexLayoutSectionProps {
  direction: 'row' | 'column';
  gap: number;
  padding: Padding;
  justifyContent: JustifyContent;
  alignItems: AlignItems;
  onGapChange: (value: number) => void;
  onPaddingChange: (value: Padding) => void;
  onJustifyContentChange: (value: JustifyContent) => void;
  onAlignItemsChange: (value: AlignItems) => void;
}

export function FlexLayoutSection({
  direction,
  gap,
  padding,
  justifyContent,
  alignItems,
  onGapChange,
  onPaddingChange,
  onJustifyContentChange,
  onAlignItemsChange
}: FlexLayoutSectionProps) {
  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Layout</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <PanelSubSection>
          <PanelSubSectionTitle>Gap</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <NumberInput
              min={0}
              onChange={onGapChange}
              suffix="px"
              value={gap}
            />
          </PanelSubSectionContent>
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Main Axis</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <JustifyContentInput
              direction={direction}
              onChange={onJustifyContentChange}
              value={justifyContent}
            />
          </PanelSubSectionContent>
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Cross Axis</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <AlignItemsInput
              direction={direction}
              onChange={onAlignItemsChange}
              value={alignItems}
            />
          </PanelSubSectionContent>
        </PanelSubSection>

        <PanelSubSection>
          <PanelSubSectionTitle>Padding</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <SpacingInput onChange={onPaddingChange} value={padding} />
          </PanelSubSectionContent>
        </PanelSubSection>
      </PanelSectionContent>
    </PanelSection>
  );
}

