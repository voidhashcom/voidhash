'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ToggleGroup,
  ToggleGroupItem
} from '@voidhash/ui';
import {
  Columns2Icon,
  GalleryVerticalIcon,
  LayoutPanelLeft,
  MousePointer2Icon,
  Rows2Icon,
  TypeIcon
} from 'lucide-react';
import { useDesignerActions, useDesignerSelect } from '../state/designer-store';
import type { AvailableTool } from '../state/schema';

function LayoutToolIcon({ tool }: { tool: string }) {
  switch (tool) {
    case 'rows':
      return <Rows2Icon />;
    case 'columns':
      return <Columns2Icon />;
    case 'scroll-view':
      return <GalleryVerticalIcon />;
    default:
      return <LayoutPanelLeft />;
  }
}

function LayoutDropdownMenu({
  activeTool,
  onChange
}: {
  activeTool: AvailableTool;
  onChange: (tool: AvailableTool) => void;
}) {
  const availableTools: AvailableTool[] = ['rows', 'columns', 'scroll-view'];
  const isAnyLayoutToolActive = availableTools.some(
    (tool) => tool === activeTool
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div>
          <ToggleGroupItem
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            value={isAnyLayoutToolActive ? activeTool : 'layout'}
            variant="primary"
          >
            <LayoutToolIcon tool={activeTool} />
          </ToggleGroupItem>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-38">
        <DropdownMenuItem onSelect={() => onChange('rows')}>
          <span className="pointer-events-none flex size-3.5 items-center justify-center">
            <LayoutToolIcon tool="rows" />
          </span>
          <span>Rows</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange('columns')}>
          <span className="pointer-events-none flex size-3.5 items-center justify-center">
            <LayoutToolIcon tool="columns" />
          </span>
          <span>Columns</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange('scroll-view')}>
          <span className="pointer-events-none flex size-3.5 items-center justify-center">
            <LayoutToolIcon tool="scroll-view" />
          </span>
          <span>Scroll View</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ActionPanel() {
  const dispatch = useDesignerActions();
  const activeTool = useDesignerSelect((state) => state.tools.activeTool);
  return (
    <div className="fixed right-0 bottom-12 left-0 z-40 flex items-center justify-center ">
      <div className="flex flex-row gap-2 rounded-2xl border border-border bg-sidebar p-2 shadow-lg">
        <ToggleGroup
          onValueChange={(value) =>
            dispatch('setActiveTool', {
              tool: value as AvailableTool
            })
          }
          spacing={2}
          type="single"
          value={activeTool}
        >
          <ToggleGroupItem value={'cursor'} variant="primary">
            <MousePointer2Icon />
          </ToggleGroupItem>
          <ToggleGroupItem value={'text'} variant="primary">
            <TypeIcon />
          </ToggleGroupItem>
          <LayoutDropdownMenu
            activeTool={activeTool}
            onChange={(tool) =>
              dispatch('setActiveTool', {
                tool
              })
            }
          />
        </ToggleGroup>
      </div>
    </div>
  );
}
