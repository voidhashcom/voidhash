import { useQuery } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { User as RpcUser } from "@voidhash/rpc";
import { Spinner } from "@voidhash/ui";
import {
  getSessionUser,
  type SessionUser,
} from "@/features/auth/lib/session";
import { AuthProvider } from "@/features/studio/components/auth-context";
import { DefaultCatchBoundary } from "@/features/studio/components/default-cache-boundary";
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

const isAuthenticationError = (error: unknown): error is AuthenticationError => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as AuthenticationError;
  return (
    authError._tag === "Rpc/AuthenticationError" ||
    authError.failure?._tag === "Rpc/AuthenticationError"
  );
};

const getErrorMessage = (error: AuthenticationError) =>
  error.failure?.message ?? error.message ?? "";

const getErrorCause = (error: AuthenticationError) =>
  String(error.failure?.cause ?? error.cause ?? "");

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
    emailVerified: user.emailVerified,
    id: user.externalId ?? user.id,
    image: user.profilePictureUrl ?? null,
    name: getSessionUserName(user),
    organizations: [],
    projects: [],
    role: null,
    updatedAt: toDate(user.updatedAt),
  }) satisfies typeof RpcUser.Type;

export const Route = createFileRoute("/studio/_authenticated")({
  ssr: false,
  loader: async ({ context, location }) => {
    const sessionUser = await getSessionUser();

    const redirectToLogin = (): never => {
      const nextPath = `${location.pathname}${location.searchStr}${location.hash}`;
      const searchParams = new URLSearchParams({ next: nextPath });
      throw redirect({ href: `/auth/login?${searchParams.toString()}` });
    };

    const authenticatedUser = sessionUser ?? redirectToLogin();

    try {
      // Read through the query cache so an optimistic write (e.g. right after
      // creating an organization) is honored without a network round-trip, and
      // so intra-app navigations within `staleTime` don't re-block on a
      // CurrentUser fetch + full-screen skeleton. `getCurrentUser` stays the
      // fetcher, so the error shapes handled below are unchanged.
      const user = await context.queryClient.ensureQueryData({
        queryFn: () => getCurrentUser(),
        queryKey: queryKeys.user.getUser(),
        staleTime: 30_000,
      });
      return user;
    } catch (error) {
      if (isDatabaseAuthenticationError(error)) {
        const user = getSessionFallbackUser(authenticatedUser);
        context.queryClient.setQueryData(queryKeys.user.getUser(), user);
        return user;
      }

      if (isAuthenticationError(error)) {
        redirectToLogin();
      }
      throw error;
    }
  },
  component: RouteComponent,
  errorComponent: AuthErrorComponent,
  pendingComponent: DashboardShellSkeleton,
  pendingMs: 0,
});

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
