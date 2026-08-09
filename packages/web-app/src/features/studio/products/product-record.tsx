"use client";
import type { Product } from "@voidhash/rpc";
import { cn } from "@voidhash/ui";

export function ProductRecord({
  product,
  configurationStateIndicator,
  isSelected,
  onSelect,
}: {
  product: typeof Product.Type;
  configurationStateIndicator: React.ReactNode;
  isSelected: boolean;
  onSelect: (productId: string) => void;
}) {
  return (
    <button
      aria-selected={isSelected}
      className={cn(
        "group relative isolate flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-accent/30",
        // Inset box-shadow mimics the accent indicator used by the
        // events-activity panel.
        isSelected && "bg-accent/30 shadow-[inset_2px_0_0_0_var(--primary)]",
      )}
      data-state={isSelected ? "selected" : undefined}
      onClick={() => onSelect(product.id)}
      type="button"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="truncate font-medium text-sm">{product.name}</span>
      </div>
      <div className="shrink-0">{configurationStateIndicator}</div>
    </button>
  );
}
