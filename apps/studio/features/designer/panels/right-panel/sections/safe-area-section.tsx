'use client';

import { Switch } from '@voidhash/ui';
import type { SafeArea } from '../../../state/schema';
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle
} from '../../core/components/panel-section';

interface SafeAreaSectionProps {
  safeArea: SafeArea;
  onSafeAreaChange: (value: SafeArea) => void;
}

export function SafeAreaSection({
  safeArea,
  onSafeAreaChange
}: SafeAreaSectionProps) {
  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Safe Area</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Top</span>
            <Switch
              checked={safeArea.top}
              onCheckedChange={(checked) => {
                onSafeAreaChange({ ...safeArea, top: checked });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Bottom</span>
            <Switch
              checked={safeArea.bottom}
              onCheckedChange={(checked) => {
                onSafeAreaChange({ ...safeArea, bottom: checked });
              }}
            />
          </div>
        </div>
      </PanelSectionContent>
    </PanelSection>
  );
}
