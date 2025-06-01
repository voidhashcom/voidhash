export const ENVIRONMENTS = ["production", "testing"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];
