import { User } from "@voidhash/db";

type VoidhashBaseSession = {
	organizations: {
		id: string;
		slug: string;
		permissions: string[];
	}[];
	projects: {
		id: string;
		slug: string;
		permissions: string[];
	}[];
};

export type UserSession = VoidhashBaseSession & {
	method: "user";
	user: User;
	customer: null;
};

export type ApiKeySession = VoidhashBaseSession & {
	method: "api-key";
	user: null;
	customer: null;
};

export type PublishableApiKeySession = VoidhashBaseSession & {
	method: "publishable-api-key";
	customer: {
		appUserId: string;
		sdkOrigin: string | null;
		sdkVersion: string | null;
		os: string | null;
		device: string | null;
	};
	user: null;
};

export type VoidhashAuthSession =
	| UserSession
	| ApiKeySession
	| PublishableApiKeySession;
