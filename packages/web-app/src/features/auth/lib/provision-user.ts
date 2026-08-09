import { Duration, Effect } from "effect";

import { getCurrentUser } from "@/features/studio/lib/tanstack-query/users";

/** Hard cap so a slow/cold backend can never block the post-sign-up redirect. */
const PROVISION_TIMEOUT_MS = 5000;

/**
 * Eagerly provisions the just-authenticated user's local DB record in the
 * backend, before the client navigates to the dashboard.
 *
 * The local `user` row is otherwise created lazily by the backend auth
 * middleware on the first dashboard request. `getCurrentUser` is a server
 * function that forwards the freshly-set session cookie to the backend, whose
 * auth middleware runs `resolveLocalUser` — so the row already exists by the
 * time the dashboard loads and its first request is a plain read. The frontend
 * never touches the database directly; the backend owns the write.
 *
 * Best-effort and time-boxed: sign-up must never block on (or fail because of)
 * this, and the lazy middleware path remains the fallback when it does not
 * complete in time.
 */
export const provisionCurrentUser = (): Promise<void> =>
  Effect.runPromise(
    Effect.tryPromise(() => getCurrentUser()).pipe(
      Effect.timeout(Duration.millis(PROVISION_TIMEOUT_MS)),
      Effect.ignore,
    ),
  );
