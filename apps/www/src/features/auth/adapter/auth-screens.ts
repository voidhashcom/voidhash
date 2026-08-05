/**
 * Shape of the auth-screen slot.
 *
 * Lives apart from `ui-adapter.tsx` because that module is replaced wholesale
 * by a build alias: a private adapter must be able to import the contract
 * without importing (and so re-entering) the module it is replacing.
 *
 * A `null` screen means the route redirects to `/auth/login` instead of
 * rendering — which is what self-host wants for every self-service flow, since
 * it has exactly one user.
 */
import type { ComponentType } from "react";

/** Props every auth screen receives from its route. */
export interface AuthScreenProps {
  readonly next?: string | undefined;
}

export interface AuthScreens {
  readonly login: ComponentType<AuthScreenProps>;
  readonly signUp: ComponentType<AuthScreenProps> | null;
  readonly verifyEmail: ComponentType<AuthScreenProps> | null;
  readonly forgotPassword: ComponentType<AuthScreenProps> | null;
  readonly resetPassword: ComponentType<AuthScreenProps> | null;
}
