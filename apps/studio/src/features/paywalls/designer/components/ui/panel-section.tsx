import { cn } from "@voidhash/ui";

export function PanelSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function PanelSectionHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "my-2 flex h-7 flex-row items-center justify-between px-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PanelSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("font-medium text-sm", className)}>{children}</div>;
}

export function PanelSectionHeaderActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-row items-center justify-end gap-2", className)}
    >
      {children}
    </div>
  );
}

export function PanelSectionContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-4 px-4 pb-4", className)}>{children}</div>;
}

export function PanelSubSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function PanelSubSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("font-medium text-muted-foreground text-xs", className)}>
      {children}
    </div>
  );
}

export function PanelSubSectionContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("pt-2", className)}>{children}</div>;
}
