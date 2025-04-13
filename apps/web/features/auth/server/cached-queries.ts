import "server-only";

import { auth } from "@voidhash/auth";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return session;
});

export const getUsersOrganizations = cache(async () => {
	const organizations = await auth.api.listOrganizations({
		headers: await headers(),
	});

	return organizations;
});

export const getUser = cache(async () => {
	const session = await getSession();

	if (!session?.user) {
		return null;
	}

	const organizations = await getUsersOrganizations();

	return {
		...session.user,
		organizations,
	};
});
