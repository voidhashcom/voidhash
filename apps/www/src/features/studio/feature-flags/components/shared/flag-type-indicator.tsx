import { cn } from "@voidhash/ui";
import { Braces, CaseSensitive, Hash, ToggleRight, type LucideIcon } from "lucide-react";

import { FLAG_TYPE_LABELS, type FlagType } from "../../lib/flag-type";

/**
 * Icon and accent per value type, so a flag's type is recognisable at a glance
 * in a list without reading the label. Accents come from the chart palette,
 * which is where the design system keeps its categorical colors.
 */
export const FLAG_TYPE_PRESENTATION: Record<
  FlagType,
  { accentClassName: string; icon: LucideIcon }
> = {
  boolean: { accentClassName: "text-chart-1", icon: ToggleRight },
  json: { accentClassName: "text-chart-3", icon: Braces },
  number: { accentClassName: "text-chart-4", icon: Hash },
  string: { accentClassName: "text-chart-2", icon: CaseSensitive },
};

/** A feature flag's immutable value type, as a colored icon and its label. */
export function FlagTypeIndicator({
  className,
  flagType,
}: {
  className?: string;
  flagType: FlagType;
}) {
  const { accentClassName, icon: Icon } = FLAG_TYPE_PRESENTATION[flagType];

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <Icon className={cn("size-4 shrink-0", accentClassName)} />
      {FLAG_TYPE_LABELS[flagType]}
    </span>
  );
}
