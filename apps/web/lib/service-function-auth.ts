import { Customer, User } from "@voidhash/db";

export type UserSession = VoidhashAuthSession & {
	method: "user";
	user: User;
};

export type ApiKeySession = VoidhashAuthSession & {
	method: "api-key";
};

export type PublishableApiKeySession = VoidhashAuthSession & {
	method: "publishable-api-key";
	customer: Customer;
};

export type VoidhashAuthSession = {
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
	user: User | null;
	customer: Customer | null;
};
