import "server-only";

import { Organization, organization } from "@voidhash/db";
import { eq } from "drizzle-orm";
import { ServiceContext } from "@/lib/service-function";
import {
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	fromUnknownThrow,
} from "@voidhash/lib/constants";
import { Result, ResultAsync, err, ok } from "neverthrow";

export const getOrganizationBySlugQuery = async (
	ctx: ServiceContext,
	slug: string
): Promise<
	Result<Organization, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.organization.findFirst({
			where: eq(organization.slug, slug),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Organization not found",
			resource: "organization",
			payload: {
				slug,
			},
		});
	}
	return ok(res.value);
};

export const getOrganizationByIdQuery = async (
	ctx: ServiceContext,
	id: string
): Promise<
	Result<Organization, VoidhashInternalServerError | VoidhashNotFoundError>
> => {
	const res = await ResultAsync.fromPromise(
		ctx.db.query.organization.findFirst({
			where: eq(organization.id, id),
		}),
		(e) => fromUnknownThrow(e)
	);
	if (res.isErr()) {
		return err(res.error);
	}
	if (!res.value) {
		return err({
			code: "NOT_FOUND",
			message: "Organization not found",
			resource: "organization",
			payload: {
				id,
			},
		});
	}
	return ok(res.value);
};
