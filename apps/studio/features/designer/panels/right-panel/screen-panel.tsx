'use client';

import { useDesignerActions } from '../../state/designer-store';
import type { Padding, SafeArea, ScreenNodeData } from '../../state/schema';
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle
} from '../core/components/panel-section';
import { SpacingInput } from './inputs/spacing-input';
import { FillSection } from './sections/fill-section';
import { SafeAreaSection } from './sections/safe-area-section';

export function ScreenPanel({ node }: { node: ScreenNodeData }) {
  const dispatch = useDesignerActions();

  const handleBackgroundColorChange = (value: string | null) => {
    if (value) {
      dispatch('updateScreenNode', { id: node.id, backgroundColor: value });
    }
  };

  const handlePaddingChange = (padding: Padding) => {
    dispatch('updateScreenNode', { id: node.id, padding });
  };

  const handleSafeAreaChange = (safeArea: SafeArea) => {
    dispatch('updateScreenNode', { id: node.id, safeArea });
  };

  return (
    <>
      <FillSection
        backgroundColor={node.backgroundColor}
        onBackgroundColorChange={handleBackgroundColorChange}
      />
      <PanelSection>
        <PanelSectionHeader>
          <PanelSectionTitle>Padding</PanelSectionTitle>
        </PanelSectionHeader>
        <PanelSectionContent>
          <SpacingInput onChange={handlePaddingChange} value={node.padding} />
        </PanelSectionContent>
      </PanelSection>
      <SafeAreaSection
        onSafeAreaChange={handleSafeAreaChange}
        safeArea={node.safeArea}
      />
    </>
  );
}
