import { ToggleGroup, ToggleGroupItem } from '@voidhash/ui';
import { MousePointer2Icon, TypeIcon } from 'lucide-react';
import { useDesignerActions, useDesignerSelect } from '../state/designer-store';
import { availableToolsSchema } from '../state/schema';

export function ActionPanel() {
  const dispatch = useDesignerActions();
  const activeTool = useDesignerSelect((state) => state.tools.activeTool);
  return (
    <div className="fixed right-0 bottom-12 left-0 z-40 flex items-center justify-center ">
      <div className="flex flex-row gap-2 rounded-2xl border border-border bg-sidebar p-2 shadow-lg">
        <ToggleGroup
          onValueChange={(value) =>
            dispatch('setActiveTool', {
              tool: availableToolsSchema.parse(value)
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
        </ToggleGroup>
      </div>
    </div>
  );
}
