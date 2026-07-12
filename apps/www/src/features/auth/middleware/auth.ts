import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getAuth } from "@workos/authkit-tanstack-react-start";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const auth = await getAuth();

  if (!auth.user) {
    throw redirect({ to: "/auth/login" });
  }

  return await next();
});
