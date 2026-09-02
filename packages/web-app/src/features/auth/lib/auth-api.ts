/**
 * Browser client for the dashboard's own auth endpoints.
 *
 * Provider-specific flows (OAuth, passwords, email verification) live with the
 * screens that use them, behind the auth adapter slot.
 */
type AuthApiErrorPayload = {
  error?: string;
};

const postAuthJson = async <TResponse>(
  path: string,
  body: object,
  fallbackError: string,
): Promise<TResponse> => {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json()) as AuthApiErrorPayload & TResponse;

  if (!response.ok) {
    // oxlint-disable-next-line effect/noThrowStatement -- plain async browser helper called from React event handlers and TanStack loaders; a rejected promise is the failure channel those callers understand, and no Effect runtime is in scope.
    throw new Error(payload.error ?? fallbackError);
  }

  return payload;
};

export type RootSignInInput = {
  username: string;
  password: string;
  returnPathname?: string;
};

export type RootSignInResponse = {
  accessToken: string;
  redirectTo: string;
};

/** Standalone sign-in with the deployment's configured root credentials. */
export const signInWithRootCredentials = (input: RootSignInInput) =>
  postAuthJson<RootSignInResponse>("/api/auth/sign-in", input, "We could not sign you in.");
