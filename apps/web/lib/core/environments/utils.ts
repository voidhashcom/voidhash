import {
  fromUnknownThrow,
  type VoidhashInternalServerError,
  type VoidhashNotFoundError
} from '@voidhash/lib/constants';
import type { EnvironmentValue } from '@voidhash/lib/index';
import { err, ok, type Result, ResultAsync } from 'neverthrow';
import { cache } from 'react';
import type { CookiesAdapter } from '@/lib/cookies-adapter';

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
        code: 'NOT_FOUND',
        message: 'Project environment not found',
        resource: 'projectEnvironment',
        payload: { organizationSlug, projectSlug }
      });
    }

    return ok(
      Number.parseInt(projectEnvironmentCookie.value, 10) as EnvironmentValue
    );
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
