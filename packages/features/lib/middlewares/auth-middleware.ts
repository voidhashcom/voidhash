import { createMiddleware } from "@tanstack/react-start";
import { auth } from "../../auth/lib";
import { getWebRequest } from "@tanstack/react-start/server";
import { UnauthorizedError } from "../errors";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
	const request = getWebRequest()!;
	const session = await auth.api.getSession({
		headers: request.headers,
	});
	if (!session) {
		throw new UnauthorizedError("Unauthorized");
	}
	return next({
		context: {
			user: session.user,
		},
	});
});
