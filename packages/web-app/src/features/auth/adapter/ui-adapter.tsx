/**
 * Browser-side identity-provider slot.
 *
 * Companion to `session-adapter.ts`: the screens and browser credential that
 * differ per identity provider. Other editions can supply a richer set of
 * screens; the Community default offers the single standalone sign-in screen
 * and reports the rest as unavailable.
 *
 * A `null` screen means the route redirects to `/auth/login` instead of
 * rendering — which is what self-host wants for every self-service flow, since
 * it has exactly one user.
 */
import { StandaloneLoginScreen } from "../components/standalone-login-screen";
import type { AuthScreenProps, AuthScreens } from "./auth-screens";

export type { AuthScreenProps, AuthScreens };

export const authScreens: AuthScreens = {
  forgotPassword: null,
  login: StandaloneLoginScreen,
  resetPassword: null,
  signUp: null,
  verifyEmail: null,
};

/**
 * Wraps the application root. The standalone provider keeps no client-side auth
 * context, so the default is a passthrough.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * Memoized for the lifetime of the document: the session only changes across a
 * full navigation (sign-in and sign-out each perform one).
 */
let accessToken: Promise<string | undefined> | undefined;

/**
 * Supplies the browser RPC client's bearer credential. The session cookie is
 * `HttpOnly`, so the token is read back from the session endpoint rather than
 * from `document.cookie`.
 */
export function useBrowserAccessTokenProvider(): () => Promise<string | undefined> {
  return () => {
    accessToken ??= fetch("/api/auth/session", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { accessToken?: string | null } | null) => body?.accessToken ?? undefined)
      .catch(() => undefined);
    return accessToken;
  };
}

/** Drops the memoized credential when the bridge unmounts. */
export function resetBrowserAccessToken(): void {
  accessToken = undefined;
}
