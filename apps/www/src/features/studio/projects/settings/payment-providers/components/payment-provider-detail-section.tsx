import type { ReactNode } from "react";

export function PaymentProviderDetailSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-medium text-sm">{title}</h2>
        <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
      {children}
    </div>
  );
}
