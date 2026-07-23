import { Button } from "@voidhash/ui";
import { XIcon } from "lucide-react";

export function PopoverHeader({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <div className="flex flex-row p-2 -mx-2 -mt-3 justify-between items-center">
      <span className="text-sm font-medium">{title}</span>
      {onClose && (
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon />
        </Button>
      )}
    </div>
  );
}
