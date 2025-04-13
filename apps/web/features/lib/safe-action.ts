import { auth } from "@voidhash/auth";
import {
	createSafeActionClient,
	DEFAULT_SERVER_ERROR_MESSAGE,
} from "next-safe-action";
import { headers } from "next/headers";
import { VoidhashError } from "./errors";

export const actionClient = createSafeActionClient({
	handleServerError(e) {
		// Log to console.
		console.error("Action error:", e.message);

		// In this case, we can use the 'MyCustomError` class to unmask errors
		// and return them with their actual messages to the client.
		if (e instanceof VoidhashError) {
			return e.message;
		}

		// Every other error that occurs will be masked with the default message.
		return DEFAULT_SERVER_ERROR_MESSAGE;
	},
});

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
