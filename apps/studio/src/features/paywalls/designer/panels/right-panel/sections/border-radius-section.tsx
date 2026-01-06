'use client';

import { Schema } from 'effect';
import {
  FullscreenIcon,
  ScanIcon,
  SquareRoundCorner,
  VaultIcon
} from 'lucide-react';
import { useState } from 'react';
import { PanelButton } from '@/features/designer/components/button';
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent
} from '@/features/designer/components/panel-section';
import type { NodeEditorProps, NodeWithProperties } from '../../types';
import { TextInput } from '../inputs/text-input';

/** Properties needed for the border radius section - individual style properties */
type BorderRadiusPropertyNames =
  | 'borderRadiusTopLeft'
  | 'borderRadiusTopRight'
  | 'borderRadiusBottomRight'
  | 'borderRadiusBottomLeft';

export interface BorderRadiusSectionProps
  extends NodeEditorProps<BorderRadiusPropertyNames> {
  onNodeChange: (node: NodeWithProperties<BorderRadiusPropertyNames>) => void;
}

function shouldShowIndividualBorderRadius(
  node: NodeEditorProps<BorderRadiusPropertyNames>['node']
) {
  return (
    node.borderRadiusTopLeft !== node.borderRadiusTopRight ||
    node.borderRadiusTopLeft !== node.borderRadiusBottomRight ||
    node.borderRadiusTopLeft !== node.borderRadiusBottomLeft ||
    node.borderRadiusTopRight !== node.borderRadiusBottomRight ||
    node.borderRadiusTopRight !== node.borderRadiusBottomLeft ||
    node.borderRadiusBottomRight !== node.borderRadiusBottomLeft
  );
}

export function BorderRadiusSection({
  node,
  onNodeChange
}: BorderRadiusSectionProps) {
  const [showIndividualBorderRadius, setShowIndividualBorderRadius] = useState(
    shouldShowIndividualBorderRadius(node)
  );

  const expandBorderRadius = () => {
    setShowIndividualBorderRadius(true);
  };

  const collapseBorderRadius = () => {
    setShowIndividualBorderRadius(false);
    const allCornersValue = node.borderRadiusTopLeft;
    onNodeChange({
      ...node,
      borderRadiusTopLeft: allCornersValue,
      borderRadiusTopRight: allCornersValue,
      borderRadiusBottomRight: allCornersValue,
      borderRadiusBottomLeft: allCornersValue
    });
  };

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Border Radius</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <PanelSubSection>
          <PanelSubSectionContent>
            <div className="flex flex-row gap-2">
              {/* Single Border Radius Input (Default) */}
              {!showIndividualBorderRadius && (
                <TextInput
                  icon={<ScanIcon className="size-3.5" />}
                  label="Radius"
                  minValue={0}
                  maxValue={100}
                  onChange={(value) => {
                    const numValue = Number(value);
                    onNodeChange({
                      ...node,
                      borderRadiusTopLeft: numValue,
                      borderRadiusTopRight: numValue,
                      borderRadiusBottomRight: numValue,
                      borderRadiusBottomLeft: numValue
                    });
                  }}
                  type="number"
                  typeNumberStepIncrement={1}
                  validator={Schema.String}
                  value={node.borderRadiusTopLeft.toString()}
                />
              )}

              {/* Individual Border Radius (Expanded) */}
              {showIndividualBorderRadius && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-row gap-2">
                    <TextInput
                      icon={
                        <SquareRoundCorner className="-scale-x-100 size-3.5" />
                      }
                      label="Top Left"
                      minValue={0}
                      maxValue={100}
                      onChange={(value) =>
                        onNodeChange({
                          ...node,
                          borderRadiusTopLeft: Number(value)
                        })
                      }
                      type="number"
                      typeNumberStepIncrement={1}
                      validator={Schema.String}
                      value={node.borderRadiusTopLeft.toString()}
                    />
                    <TextInput
                      icon={<SquareRoundCorner className="size-3.5" />}
                      label="Top Right"
                      minValue={0}
                      maxValue={100}
                      onChange={(value) =>
                        onNodeChange({
                          ...node,
                          borderRadiusTopRight: Number(value)
                        })
                      }
                      type="number"
                      typeNumberStepIncrement={1}
                      validator={Schema.String}
                      value={node.borderRadiusTopRight.toString()}
                    />
                  </div>
                  <div className="flex flex-row gap-2">
                    <TextInput
                      icon={
                        <SquareRoundCorner className="rotate-180 size-3.5" />
                      }
                      label="Bottom Left"
                      minValue={0}
                      maxValue={100}
                      onChange={(value) =>
                        onNodeChange({
                          ...node,
                          borderRadiusBottomLeft: Number(value)
                        })
                      }
                      type="number"
                      typeNumberStepIncrement={1}
                      validator={Schema.String}
                      value={node.borderRadiusBottomLeft.toString()}
                    />
                    <TextInput
                      icon={
                        <SquareRoundCorner className="rotate-180 -scale-x-100  size-3.5" />
                      }
                      label="Bottom Right"
                      minValue={0}
                      maxValue={100}
                      onChange={(value) =>
                        onNodeChange({
                          ...node,
                          borderRadiusBottomRight: Number(value)
                        })
                      }
                      type="number"
                      typeNumberStepIncrement={1}
                      validator={Schema.String}
                      value={node.borderRadiusBottomRight.toString()}
                    />
                  </div>
                </div>
              )}

              <PanelButton
                icon={
                  showIndividualBorderRadius ? (
                    <VaultIcon className="size-3.5" />
                  ) : (
                    <FullscreenIcon className="size-3.5" />
                  )
                }
                onClick={() =>
                  showIndividualBorderRadius
                    ? collapseBorderRadius()
                    : expandBorderRadius()
                }
              />
            </div>
          </PanelSubSectionContent>
        </PanelSubSection>
      </PanelSectionContent>
    </PanelSection>
  );
}
