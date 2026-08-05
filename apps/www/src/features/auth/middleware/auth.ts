import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getSessionUser } from "../lib/session";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const user = await getSessionUser();

  if (!user) {
    throw redirect({ to: "/auth/login" });
  }

  return await next();
});
