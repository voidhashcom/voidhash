type AuthApiErrorPayload = {
  error?: string;
};

type AuthRedirectResponse = {
  redirectTo?: string;
};

/**
 * Fields returned by sign-up / sign-in when the account exists but its email is
 * not yet verified. The client uses these to drive the verify-email step.
 */
type EmailVerificationChallenge = {
  email?: string;
  emailVerificationRequired?: boolean;
  pendingAuthenticationToken?: string;
  userId?: string;
};

type SignUpResponse = AuthRedirectResponse & EmailVerificationChallenge;

type SignInResponse = AuthRedirectResponse & EmailVerificationChallenge;

type VerifyEmailResponse = AuthRedirectResponse & {
  verified?: boolean;
};

type ResendVerificationResponse = {
  ok?: boolean;
};

type ForgotPasswordResponse = {
  message?: string;
};

type SignInPasswordInput = {
  email: string;
  password: string;
  returnPathname?: string;
};

type SignUpPasswordInput = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  returnPathname?: string;
};

type ForgotPasswordInput = {
  email: string;
};

type ResetPasswordInput = {
  password: string;
  token: string;
};

type VerifyEmailInput = {
  code: string;
  email?: string;
  pendingAuthenticationToken?: string;
  returnPathname?: string;
};

type ResendVerificationInput = {
  email?: string;
  userId?: string;
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
    throw new Error(payload.error ?? fallbackError);
  }

  return payload;
};

export const signInWithPassword = (input: SignInPasswordInput) =>
  postAuthJson<SignInResponse>("/api/auth/password/sign-in", input, "We could not sign you in.");

export const verifyEmailCode = (input: VerifyEmailInput) =>
  postAuthJson<VerifyEmailResponse>(
    "/api/auth/email/verify",
    input,
    "We could not verify your email.",
  );

export const resendVerificationCode = (input: ResendVerificationInput) =>
  postAuthJson<ResendVerificationResponse>(
    "/api/auth/email/resend",
    input,
    "We could not send a new code.",
  );

export const signUpWithPassword = (input: SignUpPasswordInput) =>
  postAuthJson<SignUpResponse>(
    "/api/auth/password/sign-up",
    input,
    "We could not create your account.",
  );

export const requestPasswordReset = (input: ForgotPasswordInput) =>
  postAuthJson<ForgotPasswordResponse>(
    "/api/auth/password/forgot-password",
    input,
    "We could not send a reset link.",
  );

export const resetPassword = (input: ResetPasswordInput) =>
  postAuthJson<AuthRedirectResponse>(
    "/api/auth/password/reset-password",
    input,
    "We could not reset your password.",
  );
