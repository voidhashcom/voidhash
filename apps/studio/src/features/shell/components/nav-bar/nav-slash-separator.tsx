import { cn } from "@voidhash/ui/utils";

export function NavSlashSeparator({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 text-muted-foreground", className)}
      fill="none"
      viewBox="0 0 9 22"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Nav Slash Separator</title>
      <path d="M1 21L8.5 0.5" stroke="currentColor" />
    </svg>
  );
}
