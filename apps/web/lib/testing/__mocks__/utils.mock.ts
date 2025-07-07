// import { Effect } from "effect";
// import { vi } from "vitest";
// import { Environment, EnvironmentValue } from "@voidhash/lib/constants";

// // Mock for createSecretKey function
// export const createMockSecretKey = (environment: EnvironmentValue = Environment.Testing) => ({
// 	key: "mocked_hashed_key_1234567890abcdef",
// 	rawKey: environment === Environment.Production ? "vh_sk_mocked_raw_key_1234567890abcdef" : "vh_sk_test_mocked_raw_key_1234567890abcdef",
// 	environment,
// 	isPublic: false,
// 	end: "efgh",
// 	prefix: environment === Environment.Production ? "vh_sk_" : "vh_sk_test_",
// });

// export const createMockSecretKeyEffect = (environment: EnvironmentValue = Environment.Testing) =>
// 	Effect.succeed(createMockSecretKey(environment));

// // Mock for generateId function
// export const createMockGenerateId = (prefix: string) => `${prefix}_mocked_id_1234567890`;

// // Mock for checkProjectPermission function
// export const createMockCheckProjectPermission = (shouldSucceed: boolean = true) => {
// 	if (shouldSucceed) {
// 		return Effect.succeed(undefined);
// 	} else {
// 		return Effect.fail(new Error("Permission denied"));
// 	}
// }; 