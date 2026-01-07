import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function CopyText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await navigator.clipboard.writeText(text);

    toast.success("Copied to clipboard");
  };

  return (
    <div className={cn("flex items-center space-x-4", className)}>
      <span className="w-32 min-w-0 flex-1 whitespace-pre-wrap break-words ">
        {text}
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="z-20"
              onClick={handleCopy}
              size="icon"
              variant="outline"
            >
              <CopyIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to copy</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
