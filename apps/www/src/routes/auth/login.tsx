import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { authScreens } from "@/features/auth/adapter/ui-adapter";

const loginSearchSchema = z.object({
  email: z.string().default(""),
  error: z.string().optional(),
  next: z.string().optional(),
  reset: z.string().optional(),
  signup: z.boolean().default(false),
});

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
  validateSearch: zodValidator(loginSearchSchema),
});

function LoginPage() {
  const { next } = Route.useSearch();
  const LoginScreen = authScreens.login;
  return <LoginScreen next={next} />;
}
