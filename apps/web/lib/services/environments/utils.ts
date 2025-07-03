import {
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { type EnvironmentValue } from "@voidhash/lib/index";
import { CookiesAdapter } from "@/lib/cookies-adapter";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { cache } from "react";

export const getEnvironment = cache(
	async (
		cookies: CookiesAdapter,
		organizationSlug: string,
		projectSlug: string
	): Promise<
		Result<
			EnvironmentValue,
			VoidhashInternalServerError | VoidhashNotFoundError
		>
	> => {
		const projectEnvironmentCookie = await ResultAsync.fromPromise(
			cookies.get(`project_environment_${organizationSlug}:${projectSlug}`),
			(e) => fromUnknownThrow(e)
		);

		if (projectEnvironmentCookie.isErr()) {
			return err(projectEnvironmentCookie.error);
		}

		if (!projectEnvironmentCookie.value) {
			return err({
				code: "NOT_FOUND",
				message: "Project environment not found",
				resource: "projectEnvironment",
				payload: { organizationSlug, projectSlug },
			});
		}

		return ok(parseInt(projectEnvironmentCookie.value) as EnvironmentValue);
	}
);

export async function setEnvironment(
	cookies: CookiesAdapter,
	organizationSlug: string,
	projectSlug: string,
	environment: EnvironmentValue
): Promise<Result<void, VoidhashInternalServerError>> {
	const res = await ResultAsync.fromPromise(
		cookies.set(
			`project_environment_${organizationSlug}:${projectSlug}`,
			environment.toString()
		),
		(e) => fromUnknownThrow(e)
	);

	if (res.isErr()) {
		return err(res.error);
	}

	return ok(undefined);
}
