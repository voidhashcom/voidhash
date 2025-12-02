import { STUDIO_DOMAIN } from "@voidhash/lib";
import {
	apiKeyClient,
	oidcClient,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Replace localhost with the actual IP address if STUDIO_DOMAIN contains localhost.
 * This allows accessing the server from other devices on the same network.
 */
const getBaseURL = (): string => {
	if (STUDIO_DOMAIN.includes("localhost")) {
		if (
			typeof window !== "undefined" &&
			!window.location.hostname.includes("localhost")
		) {
			const ip = window.location.hostname.split(":")[0] ?? "localhost";
			return STUDIO_DOMAIN.replace("localhost", ip);
		}
	}
	return STUDIO_DOMAIN;
};

export const authClient = createAuthClient({
	baseURL: getBaseURL(),
	basePath: "/studio/api/auth",
	plugins: [organizationClient(), apiKeyClient(), oidcClient()],
});
