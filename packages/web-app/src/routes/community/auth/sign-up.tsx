import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { authScreens } from "@/features/auth/adapter/ui-adapter";

/**
 * Self-service screen. Providers that do not offer it — self-host, which has a
 * single environment-configured user — leave the slot empty, and the route
 * sends the visitor to sign in instead.
 */
export const Route = createFileRoute("/auth/sign-up")({
  beforeLoad: () => {
    // oxlint-disable-next-line effect/noThrowStatement -- `throw redirect(...)` is TanStack Router's control-flow contract for route guards; the router catches the thrown redirect, so it cannot be modelled as a tagged error.
    if (authScreens.signUp === null) throw redirect({ to: "/auth/login" });
  },
  component: ScreenPage,
  validateSearch: zodValidator(
    z.object({
      email: z.string().optional(),
      next: z.string().optional(),
      token: z.string().optional(),
    }),
  ),
});

function ScreenPage() {
  const { next } = Route.useSearch();
  const Screen = authScreens.signUp;
  return Screen === null ? null : <Screen next={next} />;
}
