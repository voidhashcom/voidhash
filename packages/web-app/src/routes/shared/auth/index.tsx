import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@voidhash/ui";
import { LogOut } from "lucide-react";

import { AuthHeader, AuthLayout } from "@/features/auth/components/auth-layout";
import { getSessionUser } from "@/features/auth/lib/session";
import { authMiddleware } from "@/features/auth/middleware/auth";
import { redirectToSignOut } from "@/features/auth/lib/sign-out";

export const Route = createFileRoute("/auth/")({
  component: HomePage,
  loader: async () => {
    const user = await getSessionUser();
    if (!user) {
      // oxlint-disable-next-line effect/noThrowStatement -- `throw redirect(...)` is TanStack Router's control-flow contract for route guards; the router catches the thrown redirect, so it cannot be modelled as a tagged error.
      throw redirect({ to: "/auth/login" });
    }
    return { user };
  },
  server: {
    middleware: [authMiddleware],
  },
});

function HomePage() {
  const { user } = Route.useLoaderData();

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <AuthLayout>
      <AuthHeader description={user.email} title={`Welcome, ${name}`} />
      <div className="mt-10 flex flex-col gap-6">
        <p className="text-muted-foreground text-sm">You are signed in to Voidhash.</p>
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full cursor-pointer" size="lg" variant="outline">
            <Link to="/">Go to homepage</Link>
          </Button>
          <Button
            className="w-full cursor-pointer"
            onClick={() => redirectToSignOut("/auth/login")}
            size="lg"
            variant="destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
