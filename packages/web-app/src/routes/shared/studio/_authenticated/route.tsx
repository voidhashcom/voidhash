import { useQuery } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import type { User as RpcUser } from "@voidhash/rpc";
import { Spinner } from "@voidhash/ui";
import { Effect, Result } from "effect";
import {
  getSessionUser,
  type SessionUser,
} from "@/features/auth/lib/session";
import { AuthProvider } from "@/features/studio/components/auth-context";
import { DefaultCatchBoundary } from "@/features/studio/components/default-cache-boundary";
import { DesignerLoadingScreen } from "@/features/studio/paywalls/designer/loading-screen";
import { DashboardShellSkeleton } from "@/features/studio/shell/components/skeleton";
import { WaitlistGate } from "@/features/studio/waitlist/waitlist-gate";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import { getCurrentUser } from "@/features/studio/lib/tanstack-query/users";

type AuthenticationError = {
  _tag?: string;
  cause?: unknown;
  failure?: {
    cause?: unknown;
    message?: string;
    _tag?: string;
  };
  message?: string;
};

// `Rpc/AuthenticationError` is a failed authentication attempt;
// `Rpc/NotAuthenticatedError` is the absence of any session. Both send the
// user to the login screen.
const AUTHENTICATION_ERROR_TAGS = new Set(["Rpc/AuthenticationError", "Rpc/NotAuthenticatedError"]);

const isAuthenticationError = (error: unknown): error is AuthenticationError => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as AuthenticationError;
  return (
    (authError._tag !== undefined && AUTHENTICATION_ERROR_TAGS.has(authError._tag)) ||
    (authError.failure?._tag !== undefined &&
      AUTHENTICATION_ERROR_TAGS.has(authError.failure._tag))
  );
};

const getErrorMessage = (error: AuthenticationError) =>
  error.failure?.message ?? error.message ?? "";

const getErrorCause = (error: AuthenticationError) => {
  const cause = error.failure?.cause ?? error.cause;
  if (typeof cause === "string") return cause;
  if (cause === undefined || cause === null) return "";
  return JSON.stringify(cause);
};

const isDatabaseAuthenticationError = (error: unknown): error is AuthenticationError => {
  if (!isAuthenticationError(error)) {
    return false;
  }

  const message = getErrorMessage(error);
  const cause = getErrorCause(error);
  return (
    message.includes("database error") ||
    cause.includes("DatabaseError") ||
    cause.includes("Failed to execute transaction")
  );
};

const toDate = (value: unknown) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
};

const getSessionUserName = (user: SessionUser) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : user.email;
};

/**
 * Minimal user assembled from the identity provider's session when the
 * `CurrentUser` RPC cannot reach the database, so the shell still renders.
 */
const getSessionFallbackUser = (user: SessionUser) =>
  ({
    createdAt: toDate(user.createdAt),
    email: user.email,
    isEmailVerified: user.emailVerified,
    id: user.externalId ?? user.id,
    image: user.profilePictureUrl ?? null,
    name: getSessionUserName(user),
    organizations: [],
    projects: [],
    role: null,
    updatedAt: toDate(user.updatedAt),
  }) satisfies typeof RpcUser.Type;

export const Route = createFileRoute("/studio/_authenticated")({
  // Data-only SSR folds the CurrentUser fetch into the initial document
  // request (the session cookie is already unsealed there by the auth
  // middleware), so a cold load hydrates with the user instead of spending
  // two client round-trips behind a skeleton. Components stay client-only.
  ssr: "data-only",
  loader: async ({ context, location }) => {
    const redirectToLogin = (): never => {
      const nextPath = `${location.pathname}${location.searchStr}${location.hash}`;
      const searchParams = new URLSearchParams({ next: nextPath });
      // TanStack Router signals a redirect by throwing its descriptor; `runSync`
      // squashes the cause, so the router still sees that exact object.
      return Effect.runSync(
        Effect.die(redirect({ href: `/auth/login?${searchParams.toString()}` })),
      );
    };

    // Fetch the current user immediately — the identity-provider session is
    // only consulted on the failure paths below, so the happy path costs a
    // single round-trip. In the browser, read through the query cache so an
    // optimistic write (e.g. right after creating an organization) is honored
    // and intra-app navigations within `staleTime` don't re-block on a
    // CurrentUser fetch; during SSR, fetch directly — the module-level query
    // cache is shared across requests on the server, so it must never hold
    // per-user data there.
    const cached = await Effect.runPromise(
      Effect.tryPromise({
        try: () =>
          import.meta.env.SSR
            ? getCurrentUser()
            : context.queryClient.ensureQueryData({
                queryFn: () => getCurrentUser(),
                queryKey: queryKeys.user.getUser(),
                staleTime: 30_000,
              }),
        catch: (error) => error,
      }).pipe(Effect.result),
    );
    if (Result.isSuccess(cached)) {
      return cached.success;
    }

    const error = cached.failure;
    if (isDatabaseAuthenticationError(error)) {
      const sessionUser = (await getSessionUser()) ?? redirectToLogin();
      const user = getSessionFallbackUser(sessionUser);
      if (!import.meta.env.SSR) {
        context.queryClient.setQueryData(queryKeys.user.getUser(), user);
      }
      return user;
    }

    if (isAuthenticationError(error)) {
      redirectToLogin();
    }
    return Effect.runSync(Effect.die(error));
  },
  component: RouteComponent,
  errorComponent: AuthErrorComponent,
  pendingComponent: AuthenticatedPending,
  pendingMs: 0,
});

/**
 * Route-aware pending visual: designer destinations get the designer's
 * loading screen so the load reads as one continuous phase, everything else
 * gets the dashboard shell skeleton.
 */
function AuthenticatedPending() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname.includes("/design/")) {
    return <DesignerLoadingScreen />;
  }
  return <DashboardShellSkeleton />;
}

function RouteComponent() {
  const data = Route.useLoaderData();
  const userQuery = useQuery({
    initialData: data,
    queryFn: () => getCurrentUser(),
    queryKey: queryKeys.user.getUser(),
    staleTime: 30_000,
  });

  return (
    <AuthProvider user={userQuery.data}>
      <WaitlistGate>
        <Outlet />
      </WaitlistGate>
    </AuthProvider>
  );
}

function AuthErrorComponent(props: ErrorComponentProps) {
  // Check if this is an auth error - show loading state while redirecting
  const isAuthError = isAuthenticationError(props.error);

  if (isAuthError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <DefaultCatchBoundary {...props} />;
}
