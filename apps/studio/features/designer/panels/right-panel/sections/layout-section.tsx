import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle
} from '../../core/components/panel-section';
import { LayoutFlowInput } from '../inputs/layout-flow-input';

export function LayoutSection() {
  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Layout</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <LayoutFlowInput />
      </PanelSectionContent>
    </PanelSection>
  );
}
