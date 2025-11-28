import { cn } from '@voidhash/ui';

export function PanelSection({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function PanelSectionHeader({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('px-4 pt-4 pb-2', className)}>{children}</div>;
}

export function PanelSectionTitle({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('font-medium text-sm', className)}>{children}</div>;
}

export function PanelSectionContent({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('px-4 pt-2 pb-4', className)}>{children}</div>;
}

export function PanelSubSection({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function PanelSubSectionTitle({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pt-3 font-medium text-muted-foreground text-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

export function PanelSubSectionContent({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('pt-2', className)}>{children}</div>;
}
