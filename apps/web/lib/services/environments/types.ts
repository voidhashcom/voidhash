export type Environment = "production" | "testing";

export const Environments = {
	Production: "production" as Environment,
	Testing: "testing" as Environment,
} as const;
