import { auth } from "@voidhash/auth";
import { createSafeActionClient } from "next-safe-action";
import { headers } from "next/headers";

export const actionClient = createSafeActionClient();

// Auth client defined by extending the base one.
// Note that the same initialization options and middleware functions of the base client
// will also be used for this one.
export const authActionClient = actionClient
	// Define authorization middleware.
	.use(async ({ next }) => {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			throw new Error("User not found!");
		}

		// Return the next middleware with `userId` value in the context
		return next({ ctx: { user: session.user } });
	});
