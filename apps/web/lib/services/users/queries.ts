import "server-only";

import {
	authenticateContext,
	createServiceFunction,
} from "@/lib/service-function";
import { cache } from "react";
import { getUsersOrganizations } from "../organizations/queries";

// User
export const getUser = cache(
	createServiceFunction().function(async ({ ctx }) => {
		const authenticatedContext = await authenticateContext(ctx);

		const organizations = await getUsersOrganizations({
			ctx: authenticatedContext,
		});

		if (!authenticatedContext?.session?.user) {
			return null;
		}

		return {
			...authenticatedContext.session.user,
			organizations,
		};
	})
);
