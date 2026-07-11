"use client";

import { Switch } from "@voidhash/ui";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/components/ui/panel-section";

interface SafeAreaSectionProps {
  safeArea: {
    top: boolean;
    bottom: boolean;
  };
  onSafeAreaChange: (value: { top: boolean; bottom: boolean }) => void;
}

export function SafeAreaSection({ safeArea, onSafeAreaChange }: SafeAreaSectionProps) {
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
