/**
 * Local mirror of the `ExperimentStatus` numeric enum from `@voidhash/db`
 * (draft=1, running=2, paused=3, concluded=4). Kept here as a plain map so the
 * studio UI does not need to import the db package just for labels/lifecycle
 * gating, matching how the flags UI derives display state locally.
 */
export const EXPERIMENT_STATUS = {
  draft: 1,
  running: 2,
  paused: 3,
  concluded: 4,
} as const;

export type ExperimentStatusValue =
  (typeof EXPERIMENT_STATUS)[keyof typeof EXPERIMENT_STATUS];

export const EXPERIMENT_STATUS_LABELS: Record<number, string> = {
  [EXPERIMENT_STATUS.draft]: "Draft",
  [EXPERIMENT_STATUS.running]: "Running",
  [EXPERIMENT_STATUS.paused]: "Paused",
  [EXPERIMENT_STATUS.concluded]: "Concluded",
};

export const experimentStatusLabel = (status: number): string =>
  EXPERIMENT_STATUS_LABELS[status] ?? "Unknown";
