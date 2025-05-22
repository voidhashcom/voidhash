import "server-only";

import {
	authenticateContext,
	createServiceFunction,
} from "@/lib/service-function";
import { cache } from "react";
import { getUsersOrganizations } from "../organizations/queries";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { err, ok, Result } from "neverthrow";
import { User } from "better-auth";
import { Organization } from "@voidhash/db";

// User
type GetUserError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export type GetUserSuccess = User & {
	organizations: Organization[];
};

export const getUser = cache(
	createServiceFunction().function(
		async ({ ctx }): Promise<Result<GetUserSuccess, GetUserError>> => {
			const authenticatedContext = await authenticateContext(ctx);
			if (authenticatedContext.isErr()) {
				return err(authenticatedContext.error);
			}

			const organizations = await getUsersOrganizations({
				ctx: authenticatedContext.value,
			});

			if (organizations.isErr()) {
				return err(organizations.error);
			}

			if (!authenticatedContext.value.session?.user) {
				return err({
					code: "NOT_FOUND",
					message: "User not found",
					resource: "user",
					payload: {},
				} satisfies VoidhashNotFoundError);
			}

			return ok({
				...authenticatedContext.value.session.user,
				organizations: organizations.value,
			});
		}
	).invoke
);
