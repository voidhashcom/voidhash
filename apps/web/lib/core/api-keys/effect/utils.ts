import { base64Url } from "@voidhash/lib/functions";
import { createHash } from "@voidhash/lib/effect";
import { Effect } from "effect";
import { Environment, EnvironmentValue } from "@voidhash/lib/constants";

export type SecretKey = {
	id: string;
	key: string;
	isPublic: false;
	end: string;
	prefix: string;
	environment: EnvironmentValue;
};

export type PublishableKey = {
	id: string;
	key: string;
	isPublic: true;
	end: string;
	prefix: string;
	environment: EnvironmentValue;
};

export const PRODUCTION_SECRET_KEY_PREFIX = "vh_sk_";
export const TESTING_SECRET_KEY_PREFIX = "vh_sk_test_";
export const PRODUCTION_PUBLISHABLE_KEY_PREFIX = "vh_pk_";
export const TESTING_PUBLISHABLE_KEY_PREFIX = "vh_pk_test_";
export const KEY_END_LENGTH = 4;

const keyGenerator = (options: {
	length: number;
	prefix: string | undefined;
}) =>
	Effect.gen(function* () {
		const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
		let apiKey = `${options.prefix || ""}`;
		for (let i = 0; i < options.length; i++) {
			const randomIndex = Math.floor(Math.random() * characters.length);
			apiKey += characters[randomIndex];
		}

		return apiKey;
	});

export const hashKey = (key: string) =>
	createHash("SHA-256").pipe(
		Effect.flatMap((hashingFn) => hashingFn.digest(key)),
		Effect.map((hash) => base64Url.encode(hash, { padding: false }))
	);

export const generateSecretKey = (environment: EnvironmentValue) =>
	keyGenerator({
		length: 32,
		prefix:
			environment === Environment.Production
				? PRODUCTION_SECRET_KEY_PREFIX
				: TESTING_SECRET_KEY_PREFIX,
	});

export const generatePublishableKey = (environment: EnvironmentValue) =>
	keyGenerator({
		length: 32,
		prefix:
			environment === Environment.Production
				? PRODUCTION_PUBLISHABLE_KEY_PREFIX
				: TESTING_PUBLISHABLE_KEY_PREFIX,
	});

export const createPublishableKey = (environment: EnvironmentValue) =>
	generatePublishableKey(environment).pipe(
		Effect.map((key) => ({
			key: key,
			rawKey: key,
			environment: environment,
			isPublic: true,
			end: key.slice(-KEY_END_LENGTH),
			prefix:
				environment === Environment.Production
					? PRODUCTION_PUBLISHABLE_KEY_PREFIX
					: TESTING_PUBLISHABLE_KEY_PREFIX,
		}))
	);

export const createSecretKey = (environment: EnvironmentValue) =>
	Effect.gen(function* () {
		const key = yield* generateSecretKey(environment);
		const hashed = yield* hashKey(key);
		const end = key.slice(key.length - KEY_END_LENGTH);

		return {
			key: hashed,
			rawKey: key,
			environment: environment,
			isPublic: false,
			end: end,
			prefix:
				environment === Environment.Production
					? PRODUCTION_SECRET_KEY_PREFIX
					: TESTING_SECRET_KEY_PREFIX,
		};
	});
