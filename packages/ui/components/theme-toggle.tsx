import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "../lib/utils";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

export function ThemeToggle({
  theme,
  setTheme,
  className,
}: {
  theme: string;
  setTheme: (theme: string) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      className={cn("divide-x overflow-hidden rounded-full border border-border", className)}
      onValueChange={(value) => setTheme(value)}
      spacing={0}
      type="single"
      value={theme}
    >
      <ToggleGroupItem aria-label="Toggle system" className="h-6 p-0 px-2" value="system">
        <Monitor className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Toggle light" className="h-6 p-0 px-2" value="light">
        <Sun className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem aria-label="Toggle strikethrough" className="h-6 p-0 px-2" value="dark">
        <Moon className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
