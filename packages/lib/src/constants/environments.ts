export const Environment = {
  Production: 1,
  Testing: 2
};

export type EnvironmentValue = (typeof Environment)[keyof typeof Environment];
