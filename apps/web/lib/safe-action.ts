import {
	createSafeActionClient,
	DEFAULT_SERVER_ERROR_MESSAGE,
} from "next-safe-action";
import { VoidhashError } from "@voidhash/lib";
import { createNextServiceContext } from "./nextjs/utils/create-next-service-context";

export const actionClient = createSafeActionClient({
	async handleServerError(e) {
		const serviceContext = await createNextServiceContext();
		// Log to console.
		serviceContext.logger.error("Action error", {
			message: e.message,
			stack: e.stack,
		});

		// In this case, we can use the 'MyCustomError` class to unmask errors
		// and return them with their actual messages to the client.
		if (e instanceof VoidhashError) {
			return e.message;
		}

		// Every other error that occurs will be masked with the default message.
		return DEFAULT_SERVER_ERROR_MESSAGE;
	},
}).use(async ({ next }) => {
	const serviceContext = await createNextServiceContext();
	return next({
		ctx: {
			serviceContext,
		},
	});
});
