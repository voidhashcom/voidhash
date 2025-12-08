import { createAuthClientOptions } from "@voidhash/auth/client";
import { createAuthClient } from "better-auth/react";
import { env } from "./env";

export const authClient = createAuthClient(
	createAuthClientOptions(env.VITE_APP_STUDIO_BASE_URL),
);
