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
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage can be unavailable (private mode, storage disabled). The
    // verify page degrades to the email search param, so this is non-fatal.
  }
};

export const loadEmailVerificationState = (): EmailVerificationState | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EmailVerificationState) : null;
  } catch {
    return null;
  }
};

export const clearEmailVerificationState = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing actionable if the entry can't be removed.
  }
};
