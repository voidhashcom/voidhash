import { Effect } from "effect";

const STORAGE_KEY = "voidhash.email-verification";

/**
 * The context the verify-email page needs to complete (and resend) a 6-digit
 * email verification. It is written by sign-up / sign-in when WorkOS reports
 * `email_verification_required`.
 *
 * Stored in `sessionStorage` so it survives a page refresh but is intentionally
 * dropped when the tab closes — at which point the user re-authenticates, which
 * issues a fresh token and code.
 */
export type EmailVerificationState = {
  email: string;
  next?: string;
  pendingAuthenticationToken?: string;
  userId?: string;
};

export const saveEmailVerificationState = (state: EmailVerificationState): void => {
  if (typeof window === "undefined") {
    return;
  }
  // sessionStorage can be unavailable (private mode, storage disabled). The
  // verify page degrades to the email search param, so this is non-fatal.
  Effect.runSync(
    Effect.try(() =>
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)),
    ).pipe(Effect.ignore),
  );
};

export const loadEmailVerificationState = (): EmailVerificationState | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return Effect.runSync(
    Effect.try((): EmailVerificationState | null => {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as EmailVerificationState) : null;
    }).pipe(Effect.orElseSucceed(() => null)),
  );
};

export const clearEmailVerificationState = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  // Ignore failures — nothing actionable if the entry can't be removed.
  Effect.runSync(
    Effect.try(() => window.sessionStorage.removeItem(STORAGE_KEY)).pipe(
      Effect.ignore,
    ),
  );
};
