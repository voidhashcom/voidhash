'use client';

import {
  PanelSection,
  PanelSectionHeader,
  PanelSectionTitle
} from '../../core/components/panel-section';

interface FillSectionProps {
  backgroundColor: string | null;
  onBackgroundColorChange: (value: string | null) => void;
  allowNull?: boolean;
}

export function FillSection({
  backgroundColor,
  onBackgroundColorChange,
  allowNull = false
}: FillSectionProps) {
  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Fill</PanelSectionTitle>
      </PanelSectionHeader>
      {/* <PanelSectionContent>
        <ColorInput
          allowNull={allowNull}
          onChange={(value) => {
            onBackgroundColorChange(value === '' ? null : value);
          }}
          value={backgroundColor ?? '#ffffff'}
        />
      </PanelSectionContent> */}
    </PanelSection>
  );
}
