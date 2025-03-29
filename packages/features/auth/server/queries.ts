import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";
import { auth } from "../lib";

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
	const { headers } = getWebRequest()!;
	const res = await auth.api.getSession({
		headers: headers,
	});

	if (!res?.user) {
		return null;
	}

	const organizations = await auth.api.listOrganizations({
		headers: headers,
	});

	return {
		...res.user,
		organizations: organizations,
	};
});
