"use client";
import { ThemeToggle, cn } from "@voidhash/ui";
import { useTheme } from "next-themes";

export function DocsThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <ThemeToggle
      className={cn("hidden md:flex", className)}
      setTheme={setTheme}
      theme={theme ?? "system"}
    />
  );
}
