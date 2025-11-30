'use client';

import { ToggleGroup, ToggleGroupItem, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@voidhash/ui';
import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalSpaceAroundIcon,
  AlignHorizontalSpaceBetweenIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalSpaceAroundIcon,
  AlignVerticalSpaceBetweenIcon,
  StretchHorizontalIcon,
  StretchVerticalIcon
} from 'lucide-react';
import type { AlignItems, JustifyContent } from '../../../state/schema';

interface JustifyContentInputProps {
  value: JustifyContent;
  onChange: (value: JustifyContent) => void;
  direction: 'row' | 'column';
}

interface AlignItemsInputProps {
  value: AlignItems;
  onChange: (value: AlignItems) => void;
  direction: 'row' | 'column';
}

const JUSTIFY_OPTIONS_ROW: Array<{
  value: JustifyContent;
  icon: React.ReactNode;
  label: string;
}> = [
  {
    value: 'flex-start',
    icon: <AlignStartVerticalIcon className="size-4" />,
    label: 'Start'
  },
  {
    value: 'center',
    icon: <AlignCenterVerticalIcon className="size-4" />,
    label: 'Center'
  },
  {
    value: 'flex-end',
    icon: <AlignEndVerticalIcon className="size-4" />,
    label: 'End'
  },
  {
    value: 'space-between',
    icon: <AlignVerticalSpaceBetweenIcon className="size-4" />,
    label: 'Space Between'
  },
  {
    value: 'space-around',
    icon: <AlignVerticalSpaceAroundIcon className="size-4" />,
    label: 'Space Around'
  }
];

const JUSTIFY_OPTIONS_COLUMN: Array<{
  value: JustifyContent;
  icon: React.ReactNode;
  label: string;
}> = [
  {
    value: 'flex-start',
    icon: <AlignStartHorizontalIcon className="size-4" />,
    label: 'Start'
  },
  {
    value: 'center',
    icon: <AlignCenterHorizontalIcon className="size-4" />,
    label: 'Center'
  },
  {
    value: 'flex-end',
    icon: <AlignEndHorizontalIcon className="size-4" />,
    label: 'End'
  },
  {
    value: 'space-between',
    icon: <AlignHorizontalSpaceBetweenIcon className="size-4" />,
    label: 'Space Between'
  },
  {
    value: 'space-around',
    icon: <AlignHorizontalSpaceAroundIcon className="size-4" />,
    label: 'Space Around'
  }
];

const ALIGN_OPTIONS_ROW: Array<{
  value: AlignItems;
  icon: React.ReactNode;
  label: string;
}> = [
  {
    value: 'flex-start',
    icon: <AlignStartHorizontalIcon className="size-4" />,
    label: 'Start'
  },
  {
    value: 'center',
    icon: <AlignCenterHorizontalIcon className="size-4" />,
    label: 'Center'
  },
  {
    value: 'flex-end',
    icon: <AlignEndHorizontalIcon className="size-4" />,
    label: 'End'
  },
  {
    value: 'stretch',
    icon: <StretchHorizontalIcon className="size-4" />,
    label: 'Stretch'
  }
];

const ALIGN_OPTIONS_COLUMN: Array<{
  value: AlignItems;
  icon: React.ReactNode;
  label: string;
}> = [
  {
    value: 'flex-start',
    icon: <AlignStartVerticalIcon className="size-4" />,
    label: 'Start'
  },
  {
    value: 'center',
    icon: <AlignCenterVerticalIcon className="size-4" />,
    label: 'Center'
  },
  {
    value: 'flex-end',
    icon: <AlignEndVerticalIcon className="size-4" />,
    label: 'End'
  },
  {
    value: 'stretch',
    icon: <StretchVerticalIcon className="size-4" />,
    label: 'Stretch'
  }
];

export function JustifyContentInput({
  value,
  onChange,
  direction
}: JustifyContentInputProps) {
  const options =
    direction === 'row' ? JUSTIFY_OPTIONS_ROW : JUSTIFY_OPTIONS_COLUMN;

  return (
    <TooltipProvider delayDuration={300}>
      <ToggleGroup
        className="w-full justify-start"
        onValueChange={(newValue) => {
          if (newValue) {
            onChange(newValue as JustifyContent);
          }
        }}
        type="single"
        value={value}
        variant="outline"
      >
        {options.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem className="flex-1" value={option.value}>
                {option.icon}
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{option.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}

export function AlignItemsInput({
  value,
  onChange,
  direction
}: AlignItemsInputProps) {
  const options = direction === 'row' ? ALIGN_OPTIONS_ROW : ALIGN_OPTIONS_COLUMN;

  return (
    <TooltipProvider delayDuration={300}>
      <ToggleGroup
        className="w-full justify-start"
        onValueChange={(newValue) => {
          if (newValue) {
            onChange(newValue as AlignItems);
          }
        }}
        type="single"
        value={value}
        variant="outline"
      >
        {options.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem className="flex-1" value={option.value}>
                {option.icon}
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{option.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}

