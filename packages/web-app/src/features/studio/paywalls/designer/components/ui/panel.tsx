import { cn } from "@voidhash/ui";

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative flex flex-1 flex-col divide-y divide-border", className)}>
      {children}
    </div>
  );
}

export function PanelFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sticky right-0 bottom-0 left-0 bg-background px-4 pt-4 pb-4", className)}>
      {children}
    </div>
  );
}
