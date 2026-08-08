import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getSessionUser } from "../lib/session";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const user = await getSessionUser();

  if (!user) {
    // oxlint-disable-next-line effect/noThrowStatement -- TanStack Start's control flow: `redirect()` returns a sentinel the server middleware runtime only recognises when thrown. Returning it, or modelling it as a tagged error, would make the middleware fall through to the guarded route instead of redirecting.
    throw redirect({ to: "/auth/login" });
  }

  return await next();
});
