import { Badge } from "@voidhash/ui";
import { Braces, Layers, ToggleLeft } from "lucide-react";

import {
  type FlagType,
  FLAG_TYPE_LABELS,
  deriveFlagType,
  deriveFlagTypeFromCount,
} from "./flag-type";

const FLAG_TYPE_ICONS: Record<FlagType, React.ElementType> = {
  boolean: ToggleLeft,
  json: Braces,
  multivariant: Layers,
};

export function FlagTypeBadge({ flagType }: { flagType: FlagType }) {
  const Icon = FLAG_TYPE_ICONS[flagType];

  return (
    <Badge variant="outline">
      <Icon className="mr-1 h-3 w-3" />
      {FLAG_TYPE_LABELS[flagType]}
    </Badge>
  );
}

export function FlagTypeBadgeFromVariants({ variants }: { variants: { payload?: unknown }[] }) {
  return <FlagTypeBadge flagType={deriveFlagType(variants)} />;
}

export function FlagTypeBadgeFromCount({ variantCount }: { variantCount: number }) {
  return <FlagTypeBadge flagType={deriveFlagTypeFromCount(variantCount)} />;
}
