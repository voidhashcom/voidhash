import { cn } from "@voidhash/ui";

export function Page({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1", className)}>{children}</div>;
}

export type PageHeaderProps = {
  children?: React.ReactNode;
  rightActions?: React.ReactNode;
  className?: string;
};
export function PageHeader({ rightActions, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between px-4 py-2 border-b border-border/60 sticky top-0 z-10 bg-background",
        className,
      )}
    >
      <div>{children}</div>
      {rightActions && <div>{rightActions}</div>}
    </header>
  );
}

export type PageTitleProps = {
  children?: React.ReactNode;
  className?: string;
};
export function PageHeaderTitle({ children, className }: PageTitleProps) {
  return (
    <h1 className={cn("text-[0.8rem] font-medium text-foreground py-2", className)}>{children}</h1>
  );
}

export function PageSection() {}

export function PageSectionHeader() {}
