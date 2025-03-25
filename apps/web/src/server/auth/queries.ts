import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import { auth } from "@voidhash/auth";

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
	const { headers } = getWebRequest()!;
	const res = await auth.api.getSession({
		headers: headers,
	});

	return res?.user;
});
