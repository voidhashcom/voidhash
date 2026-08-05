/**
 * Provider-neutral session access for the dashboard.
 *
 * Route guards and loaders import from here rather than from any provider SDK,
 * so the same code path serves whichever identity provider a deployment runs.
 * The implementation lives behind the adapter slot in
 * `features/auth/adapter/session-adapter.ts`.
 */
export {
  authRequestMiddleware,
  clearSession,
  getSessionUser,
  performSignOut,
  type SessionUser,
} from "../adapter/session-adapter";
