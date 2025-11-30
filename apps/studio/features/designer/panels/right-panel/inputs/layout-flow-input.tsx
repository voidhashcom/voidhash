import { Tabs, TabsList, TabsTrigger } from '@voidhash/ui';
import { Columns2Icon, Rows2Icon } from 'lucide-react';

export function LayoutFlowInput() {
  return (
    <Tabs className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="row">
          <Rows2Icon className="mr-1 size-4" />
          <span>Row</span>
        </TabsTrigger>
        <TabsTrigger value="column">
          <Columns2Icon className="mr-1 size-4" />
          <span>Column</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
