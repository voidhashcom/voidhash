'use client';
import { cn, ThemeToggle } from '@voidhash/ui';
import { useTheme } from 'next-themes';

export function DocsThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <ThemeToggle
      className={cn('hidden md:block', className)}
      setTheme={setTheme}
      theme={theme}
    />
  );
}
