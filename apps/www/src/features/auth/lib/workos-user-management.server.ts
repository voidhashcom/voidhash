import { getAuthkit } from "@workos/authkit-tanstack-react-start";
import { WorkOS, type AuthenticationResponse } from "@workos-inc/node";

import { toSafeReturnPathname } from "./validation";

type JsonBody = Record<string, unknown>;

export type WorkosAuthConfig = {
  apiKey: string;
  clientId: string;
  cookiePassword: string;
};

export type WorkosOrganizationSelectionChallenge = {
  organizations: ReadonlyArray<{
    id: string;
    name: string;
  }>;
  pendingAuthenticationToken: string;
};

const providerBySlug = {
  github: "GitHubOAuth",
  google: "GoogleOAuth",
  microsoft: "MicrosoftOAuth",
} as const;

export type OAuthProviderSlug = keyof typeof providerBySlug;

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const getWorkosAuthConfig = (): WorkosAuthConfig => ({
  apiKey: getRequiredEnv("WORKOS_API_KEY"),
  clientId: getRequiredEnv("WORKOS_CLIENT_ID"),
  cookiePassword: getRequiredEnv("WORKOS_COOKIE_PASSWORD"),
});

export const createWorkosClient = (config = getWorkosAuthConfig()) => {
  const { apiKey, clientId } = config;
  return new WorkOS(apiKey, { clientId });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getRawData = (error: unknown) => {
  if (!isRecord(error) || !isRecord(error.rawData)) {
    return undefined;
  }

  return error.rawData;
};

const getErrorCode = (error: unknown) => {
  if (!isRecord(error)) {
    return undefined;
  }

  const rawData = getRawData(error);
  return error.code ?? rawData?.code ?? rawData?.error;
};

const getPendingAuthenticationToken = (error: unknown) => {
  if (!isRecord(error)) {
    return undefined;
  }

  const rawData = getRawData(error);
  if (typeof error.pendingAuthenticationToken === "string") {
    return error.pendingAuthenticationToken;
  }

  return typeof rawData?.pending_authentication_token === "string"
    ? rawData.pending_authentication_token
    : undefined;
};

const getOrganizations = (error: unknown) => {
  const rawData = getRawData(error);
  if (!Array.isArray(rawData?.organizations)) {
    return [];
  }

  return rawData.organizations.flatMap((organization) => {
    if (!isRecord(organization) || typeof organization.id !== "string") {
      return [];
    }

    return [
      {
        id: organization.id,
        name: typeof organization.name === "string" ? organization.name : organization.id,
      },
    ];
  });
};

/**
 * Extracts WorkOS's organization-selection challenge from an authentication
 * error. Multi-organization users receive this challenge before WorkOS can mint
 * a session-bound access token.
 */
export const getOrganizationSelectionChallenge = (
  error: unknown,
): WorkosOrganizationSelectionChallenge | null => {
  if (getErrorCode(error) !== "organization_selection_required") {
    return null;
  }

  const pendingAuthenticationToken = getPendingAuthenticationToken(error);
  const organizations = getOrganizations(error);

  if (!pendingAuthenticationToken || organizations.length === 0) {
    return null;
  }

  return { organizations, pendingAuthenticationToken };
};

/**
 * Completes a WorkOS organization-selection challenge using the first
 * organization WorkOS returned. The app loads all local memberships after the
 * session is saved, so this selection only provides the org context WorkOS
 * needs to issue the AuthKit session.
 */
export const authenticateWithOrganizationSelectionChallenge = async (
  workos: WorkOS,
  error: unknown,
  options: Pick<WorkosAuthConfig, "clientId" | "cookiePassword">,
): Promise<AuthenticationResponse | null> => {
  const challenge = getOrganizationSelectionChallenge(error);
  const organizationId = challenge?.organizations[0]?.id;

  if (!challenge || !organizationId) {
    return null;
  }

  return workos.userManagement.authenticateWithOrganizationSelection({
    clientId: options.clientId,
    organizationId,
    pendingAuthenticationToken: challenge.pendingAuthenticationToken,
    session: {
      cookiePassword: options.cookiePassword,
      sealSession: true,
    },
  });
};

const appendHeaders = (target: Headers, source?: Record<string, string | string[]>) => {
  if (!source) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        target.append(key, item);
      }
      continue;
    }

    target.append(key, value);
  }
};

export const jsonResponse = (
  body: JsonBody,
  init: ResponseInit = {},
  extraHeaders?: Record<string, string | string[]>,
) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  appendHeaders(headers, extraHeaders);
  return new Response(JSON.stringify(body), { ...init, headers });
};

export const authErrorResponse = (message: string, status = 400) =>
  jsonResponse({ error: message }, { status });

/**
 * Detects whether a WorkOS authentication error means "the user exists but
 * their email is not yet verified". WorkOS surfaces this two ways depending on
 * the environment's email-verification configuration:
 *
 *   - the structured `email_verification_required` auth-error code (carries a
 *     `pendingAuthenticationToken` for the inline-code step-up), or
 *   - a `GenericServerException` whose message is
 *     "Email ownership must be verified before authentication." (email-link mode).
 *
 * Both mean the same thing for sign-up: the account was created and the user
 * must verify their email before they can authenticate.
 */
export const isEmailVerificationRequiredError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    rawData?: { code?: unknown } | null;
    message?: unknown;
  };
  if (
    candidate.code === "email_verification_required" ||
    candidate.rawData?.code === "email_verification_required"
  ) {
    return true;
  }
  return (
    typeof candidate.message === "string" &&
    /email ownership must be verified|email[_\s-]?verification|verify your email/i.test(
      candidate.message,
    )
  );
};

/**
 * The pieces of an "email verification required" error that the client needs to
 * complete the inline 6-digit-code step-up.
 *
 *   - `pendingAuthenticationToken` lets us call `authenticateWithEmailVerification`,
 *     which both verifies the code and mints a session (the user lands logged in).
 *   - `userId` / `email` let us (re)send a verification code via
 *     `sendVerificationEmail` and look the account up later.
 */
export type EmailVerificationChallenge = {
  email?: string;
  pendingAuthenticationToken?: string;
  userId?: string;
};

/**
 * Extracts the email-verification challenge from a WorkOS authentication error.
 * Returns `null` when the error is not an email-verification-required error.
 *
 * The structured `email_verification_required` error (code mode) carries the
 * `pending_authentication_token` and the `user` object; link-mode
 * (`GenericServerException`) carries neither, so the corresponding fields are
 * left undefined and the caller falls back to an email lookup.
 */
export const getEmailVerificationChallenge = (
  error: unknown,
): EmailVerificationChallenge | null => {
  if (!isEmailVerificationRequiredError(error)) {
    return null;
  }
  const candidate = error as {
    pendingAuthenticationToken?: unknown;
    rawData?: {
      pending_authentication_token?: unknown;
      user?: { id?: unknown; email?: unknown } | null;
    } | null;
  };
  const token =
    typeof candidate.pendingAuthenticationToken === "string"
      ? candidate.pendingAuthenticationToken
      : typeof candidate.rawData?.pending_authentication_token === "string"
        ? candidate.rawData.pending_authentication_token
        : undefined;
  const user = candidate.rawData?.user ?? null;
  return {
    email: typeof user?.email === "string" ? user.email : undefined,
    pendingAuthenticationToken: token,
    userId: typeof user?.id === "string" ? user.id : undefined,
  };
};

/**
 * Looks up a WorkOS user id by email. Used to (re)send verification codes when
 * we don't already have the user id from an authentication error.
 */
export const findUserIdByEmail = async (
  workos: WorkOS,
  email: string,
): Promise<string | undefined> => {
  if (!email) {
    return undefined;
  }
  const { data } = await workos.userManagement.listUsers({ email });
  return data[0]?.id;
};

export const getJsonBody = async <T extends object>(request: Request): Promise<Partial<T>> => {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {} as Partial<T>;
  }
};

export const getSafeReturnPathnameFromRequest = (request: Request, fallback = "/studio") => {
  const url = new URL(request.url);
  return toSafeReturnPathname(url.searchParams.get("returnPathname"), url.origin) ?? fallback;
};

export const getSafeReturnPathname = (
  request: Request,
  value: string | null | undefined,
  fallback = "/studio",
) => toSafeReturnPathname(value, new URL(request.url).origin) ?? fallback;

export const responseWithSession = async (
  authResponse: AuthenticationResponse,
  body: JsonBody,
  init: ResponseInit = {},
) => {
  if (!authResponse.sealedSession) {
    throw new Error("WorkOS did not return a sealed session");
  }

  const authkit = await getAuthkit();
  const sessionResult = await authkit.saveSession(undefined, authResponse.sealedSession);
  const headers =
    sessionResult.headers ??
    (sessionResult.response?.headers.get("Set-Cookie")
      ? { "Set-Cookie": sessionResult.response.headers.get("Set-Cookie") as string }
      : undefined);

  return jsonResponse(body, init, headers);
};

export const redirectWithSession = async (
  authResponse: AuthenticationResponse,
  location: string,
  status = 303,
) => {
  if (!authResponse.sealedSession) {
    throw new Error("WorkOS did not return a sealed session");
  }

  const authkit = await getAuthkit();
  const sessionResult = await authkit.saveSession(undefined, authResponse.sealedSession);
  const headers = new Headers({ Location: location });
  appendHeaders(headers, sessionResult.headers);

  const setCookie = sessionResult.response?.headers.get("Set-Cookie");
  if (setCookie) {
    headers.append("Set-Cookie", setCookie);
  }

  return new Response(null, { headers, status });
};

export const getProviderForSlug = (slug: string | undefined) => {
  if (!slug || !(slug in providerBySlug)) {
    return undefined;
  }

  return providerBySlug[slug as OAuthProviderSlug];
};
