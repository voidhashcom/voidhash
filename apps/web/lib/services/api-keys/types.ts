import { Environment } from "../environments/types";

export type ApiKey = {
	key: string;
	rawKey?: string;
	environment: Environment;
	isPublic: boolean;
	end: string;
	prefix: string;
};
