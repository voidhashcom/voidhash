import { auth } from "@voidhash/features/auth/lib";
import { createAPIFileRoute } from "@tanstack/react-start/api";

export const APIRoute = createAPIFileRoute("/api/auth/$")({
	GET: ({ request }) => {
		console.log("GET");
		return auth.handler(request);
	},
	POST: ({ request }) => {
		console.log("POST");
		return auth.handler(request);
	},
});
