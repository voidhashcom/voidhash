import { base64Url, createId } from "@voidhash/lib/functions";
import { Environment, Environments } from "../environments/types";
import { createHash } from "@voidhash/lib";

const keyGenerator = async (options: {
	length: number;
	prefix: string | undefined;
}) => {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	let apiKey = `${options.prefix || ""}`;
	for (let i = 0; i < options.length; i++) {
		const randomIndex = Math.floor(Math.random() * characters.length);
		apiKey += characters[randomIndex];
	}

	return apiKey;
};

export type SecretKey = {
	id: string;
	key: string;
	isPublic: false;
	end: string;
	prefix: string;
	environment: Environment;
};

export type PublishableKey = {
	id: string;
	key: string;
	isPublic: true;
	end: string;
	prefix: string;
	environment: Environment;
};

export const PRODUCTION_SECRET_KEY_PREFIX = "vh_sk_";
export const TESTING_SECRET_KEY_PREFIX = "vh_sk_test_";
export const PRODUCTION_PUBLISHABLE_KEY_PREFIX = "vh_pk_";
export const TESTING_PUBLISHABLE_KEY_PREFIX = "vh_pk_test_";

async function generateSecretKey(environment: Environment) {
	const key = await keyGenerator({
		length: 32,
		prefix:
			environment === Environments.Production
				? PRODUCTION_SECRET_KEY_PREFIX
				: TESTING_SECRET_KEY_PREFIX,
	});

	return key;
}

async function generatePublishableKey(environment: Environment) {
	const key = await keyGenerator({
		length: 32,
		prefix:
			environment === Environments.Production
				? PRODUCTION_PUBLISHABLE_KEY_PREFIX
				: TESTING_PUBLISHABLE_KEY_PREFIX,
	});

	return key;
}

export const createPublishableKey = async (environment: Environment) => {
	const key = await generatePublishableKey(environment);
	return {
		key: key,
		environment: environment,
		isPublic: true,
		end: key.slice(-KEY_END_LENGTH),
		prefix:
			environment === Environments.Production
				? PRODUCTION_PUBLISHABLE_KEY_PREFIX
				: TESTING_PUBLISHABLE_KEY_PREFIX,
	};
};

export const createSecretKey = async (environment: Environment) => {
	const key = await generateSecretKey(environment);
	const hash = await createHash("SHA-256").digest(key);
	const hashed = base64Url.encode(hash, {
		padding: false,
	});

	return {
		key: hashed,
		environment: environment,
		isPublic: false,
		end: key.slice(-KEY_END_LENGTH),
		prefix:
			environment === Environments.Production
				? PRODUCTION_SECRET_KEY_PREFIX
				: TESTING_SECRET_KEY_PREFIX,
	};
};
export const KEY_END_LENGTH = 4;
