import "server-only";

import { createServiceFunction } from "@/lib/service-function";
import { auth } from "@voidhash/auth";
import { cache } from "react";
import { getUsersOrganizations } from "../organizations/queries";

// Session
export const getSession = cache(
	createServiceFunction().function(async ({ ctx }) => {
		const session = await auth.api.getSession({
			headers: ctx.headers,
		});

		return session;
	})
);

// User
export const getUser = cache(
	createServiceFunction().function(async ({ ctx }) => {
		const session = await getSession({ ctx });

		if (!session?.user) {
			return null;
		}

		const organizations = await getUsersOrganizations({
			ctx: ctx,
		});

		return {
			...session.user,
			organizations,
		};
	})
);
