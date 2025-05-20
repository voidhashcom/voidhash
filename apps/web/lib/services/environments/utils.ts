import {
	fromUnknownThrow,
	VoidhashInternalServerError,
} from "@voidhash/lib/constants";
import { type Environment } from "./types";
import { CookiesAdapter } from "@/lib/cookies-adapter";
import { err, ok, Result, ResultAsync } from "neverthrow";

export async function getEnvironment(
	cookies: CookiesAdapter,
	organizationSlug: string,
	projectSlug: string
): Promise<Result<Environment | null, VoidhashInternalServerError>> {
	const projectEnvironmentCookie = await ResultAsync.fromPromise(
		cookies.get(`project_environment_${organizationSlug}:${projectSlug}`),
		(e) => fromUnknownThrow(e)
	);

	if (projectEnvironmentCookie.isErr()) {
		return err(projectEnvironmentCookie.error);
	}

	if (!projectEnvironmentCookie.value) {
		return ok(null);
	}

	return ok(projectEnvironmentCookie.value as Environment);
}

export async function setEnvironment(
	cookies: CookiesAdapter,
	organizationSlug: string,
	projectSlug: string,
	environment: Environment
): Promise<Result<void, VoidhashInternalServerError>> {
	const res = await ResultAsync.fromPromise(
		cookies.set(
			`project_environment_${organizationSlug}:${projectSlug}`,
			environment
		),
		(e) => fromUnknownThrow(e)
	);

	if (res.isErr()) {
		return err(res.error);
	}

	return ok(undefined);
}
