'use client';

import type { FontWeight, TextAlign } from '@voidhash/dff';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@voidhash/ui';
import { Schema } from 'effect';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BookTypeIcon,
  ChevronDownIcon,
  TypeIcon
} from 'lucide-react';
import { PanelButton } from '@/features/designer/components/button';
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle
} from '@/features/designer/components/panel-section';
import { SelectInput } from '@/features/designer/components/select-input';
import {
  PanelToggleGroup,
  PanelToggleGroupItem
} from '@/features/designer/components/toggle-group';
import type { NodeEditorProps } from '../../types';
import { TextInput } from '../inputs/text-input';

/** Properties needed for the typography section */
type TypographyPropertyNames =
  | 'fontSize'
  | 'fontWeight'
  | 'textAlign'
  | 'lineHeight'
  | 'letterSpacing'
  | 'color';

export interface TypographySectionProps
  extends NodeEditorProps<TypographyPropertyNames> {}

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

const FONT_FAMILY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'geist-variable', label: 'Default' }
  // { value: "inter", label: "Inter" },
  // { value: "sf-pro", label: "SF Pro" },
];

export function TypographySection({
  node,
  onNodeChange
}: TypographySectionProps) {
  const isLineHeightAuto = node.lineHeight === 0;

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Typography</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        {/* Font Picker Row */}

        <SelectInput
          disabled={true}
          icon={<BookTypeIcon className="size-3.5" />}
          label="Font Family"
          onChange={() => {
            // Do nothing
          }}
          options={FONT_FAMILY_OPTIONS}
          placeholder="Default"
          value={FONT_FAMILY_OPTIONS[0]?.value ?? ''}
        />

        {/* Font Weight and Font Size Row */}

        <div className="flex flex-row gap-2">
          <SelectInput
            icon={<div className="font-bold text-xs">W</div>}
            label="Font Weight"
            onChange={(value) =>
              onNodeChange({ ...node, fontWeight: value as FontWeight })
            }
            options={FONT_WEIGHT_OPTIONS}
            value={node.fontWeight}
          />
          <TextInput
            icon={<TypeIcon className="size-3.5" />}
            label="Font Size"
            minValue={1}
            onChange={(value) =>
              onNodeChange({ ...node, fontSize: Number(value) })
            }
            type="number"
            typeNumberStepIncrement={1}
            validator={Schema.String}
            value={node.fontSize.toString()}
          />
        </div>

        {/* Line Height and Letter Spacing Row */}

        <div className="flex flex-row gap-2">
          <TextInput
            disabled={isLineHeightAuto}
            icon={<div className="text-xs">A</div>}
            label="Line Height"
            minValue={0.5}
            onChange={(value) =>
              onNodeChange({ ...node, lineHeight: Number(value) })
            }
            trailing={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <PanelButton className="bg-transparent pr-3 dark:bg-transparent">
                    {isLineHeightAuto ? (
                      <div className="font-bold text-xs">Auto</div>
                    ) : (
                      <ChevronDownIcon className="size-3.5" />
                    )}
                  </PanelButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onSelect={() => onNodeChange({ ...node, lineHeight: 0 })}
                  >
                    Auto
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      onNodeChange({
                        ...node,
                        lineHeight: isLineHeightAuto ? 1.5 : node.lineHeight
                      })
                    }
                  >
                    Fixed (
                    {isLineHeightAuto ? '1.5' : node.lineHeight.toFixed(1)})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            type="number"
            typeNumberStepIncrement={0.1}
            validator={Schema.String}
            value={isLineHeightAuto ? 'Auto' : node.lineHeight.toString()}
          />
          <TextInput
            icon={<div className="font-mono text-xs">|A|</div>}
            label="Letter Spacing"
            onChange={(value) =>
              onNodeChange({ ...node, letterSpacing: Number(value) })
            }
            type="number"
            typeNumberStepIncrement={0.1}
            validator={Schema.String}
            value={node.letterSpacing.toString()}
          />
        </div>

        {/* Text Alignment */}
        <PanelSubSection>
          <PanelSubSectionTitle>Alignment</PanelSubSectionTitle>
          <PanelSubSectionContent>
            <div className="flex flex-row items-center gap-2">
              <PanelToggleGroup
                onValueChange={(value) => {
                  if (value) {
                    onNodeChange({ ...node, textAlign: value as TextAlign });
                  }
                }}
                type="single"
                value={node.textAlign}
              >
                <PanelToggleGroupItem value="left">
                  <AlignLeft className="size-3.5" />
                </PanelToggleGroupItem>
                <PanelToggleGroupItem value="center">
                  <AlignCenter className="size-3.5" />
                </PanelToggleGroupItem>
                <PanelToggleGroupItem value="right">
                  <AlignRight className="size-3.5" />
                </PanelToggleGroupItem>
              </PanelToggleGroup>
            </div>
          </PanelSubSectionContent>
        </PanelSubSection>
      </PanelSectionContent>
    </PanelSection>
  );
}
