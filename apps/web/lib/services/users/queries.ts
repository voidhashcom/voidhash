import "server-only";

import { createServiceFunction } from "@/lib/service-function";
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
import { isAuthenticated } from "@/lib/middlewares";

// User
type GetUserError =
	| VoidhashUnauthorizedError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export type GetUserSuccess = User & {
	organizations: Organization[];
};

export const getUser = cache(
	createServiceFunction()
		.use(isAuthenticated)
		.function(
			async ({ ctx }): Promise<Result<GetUserSuccess, GetUserError>> => {
				const organizations = await getUsersOrganizations({
					ctx,
				});

				if (organizations.isErr()) {
					if (organizations.error.code === "BAD_REQUEST") {
						return err({
							code: "INTERNAL_SERVER_ERROR",
							message:
								"Failed to get user organizations due to invalid request",
							originalError: new Error(
								"Failed to get user organizations due to invalid request"
							),
						});
					}
					return err(organizations.error);
				}

				if (!ctx.session?.user) {
					return err({
						code: "NOT_FOUND",
						message: "User not found",
						resource: "user",
						payload: {},
					} satisfies VoidhashNotFoundError);
				}

				return ok({
					...ctx.session.user,
					organizations: organizations.value,
				});
			}
		).invoke
);
