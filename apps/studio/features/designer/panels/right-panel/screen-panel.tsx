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
      dispatch('updateScreenNode', {
        id: node.id,
        property: 'backgroundColor',
        value
      });
    }
  };

  const handlePaddingChange = (padding: Padding) => {
    dispatch('updateScreenNode', {
      id: node.id,
      property: 'padding',
      value: padding
    });
  };

  const handleSafeAreaChange = (safeArea: SafeArea) => {
    dispatch('updateScreenNode', {
      id: node.id,
      property: 'safeArea',
      value: safeArea
    });
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
          <SpacingInput
            onChange={handlePaddingChange}
            value={{
              top: node.paddingTop,
              right: node.paddingRight,
              bottom: node.paddingBottom,
              left: node.paddingLeft
            }}
          />
        </PanelSectionContent>
      </PanelSection>
      <SafeAreaSection
        onSafeAreaChange={handleSafeAreaChange}
        safeArea={{
          top: node.safeAreaTop,
          bottom: node.safeAreaBottom
        }}
      />
    </>
  );
}
