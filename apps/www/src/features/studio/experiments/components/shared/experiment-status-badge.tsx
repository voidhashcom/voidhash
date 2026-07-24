import { Badge } from "@voidhash/ui";

import { EXPERIMENT_STATUS, experimentStatusLabel } from "../../lib/experiment-status";

const STATUS_VARIANTS: Record<number, "default" | "secondary" | "destructive" | "outline"> = {
  [EXPERIMENT_STATUS.draft]: "secondary",
  [EXPERIMENT_STATUS.running]: "default",
  [EXPERIMENT_STATUS.paused]: "outline",
  [EXPERIMENT_STATUS.concluded]: "secondary",
};

export function ExperimentStatusBadge({ status }: { status: number }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>{experimentStatusLabel(status)}</Badge>;
}
