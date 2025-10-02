import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../lib/utils';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

export function ThemeToggle({
  theme,
  setTheme
}: {
  theme: string;
  setTheme: (theme: string) => void;
}) {
  return (
    <ToggleGroup
      className="divide-x overflow-hidden rounded-full border border-border"
      onValueChange={(value) => setTheme(value)}
      type="single"
      value={theme}
    >
      <ToggleGroupItem
        aria-label="Toggle system"
        className={cn('h-6 p-0 px-2', theme === 'system' && 'bg-muted')}
        value="system"
      >
        <Monitor className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label="Toggle light"
        className={cn('h-6 p-0 px-2', theme === 'light' && 'bg-muted')}
        value="light"
      >
        <Sun className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label="Toggle strikethrough"
        className={cn('h-6 p-0 px-2', theme === 'dark' && 'bg-muted')}
        value="dark"
      >
        <Moon className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
