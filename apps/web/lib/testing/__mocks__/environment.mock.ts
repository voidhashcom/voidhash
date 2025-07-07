import { Environment, EnvironmentValue } from "@voidhash/lib/constants";

export const createMockEnvironment = (environment: EnvironmentValue = Environment.Testing) =>
	environment;
