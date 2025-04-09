import { createAuthClient } from "better-auth/react";
import { apiKeyClient, organizationClient } from "better-auth/client/plugins";
import { APP_DOMAIN } from "@voidhash/lib";

export const authClient = createAuthClient({
	plugins: [organizationClient(), apiKeyClient()],
});
