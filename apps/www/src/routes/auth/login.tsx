import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodValidator } from "@tanstack/zod-adapter";
import { Alert, AlertDescription, AlertTitle, Button, Input, Label, Logo } from "@voidhash/ui";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";

import { VoidhashGradientBackground } from "@/components/voidhash-gradient-background";
import { signInWithPassword } from "@/features/auth/lib/auth-api";
import { saveEmailVerificationState } from "@/features/auth/lib/email-verification-storage";

const loginSearchSchema = z.object({
  email: z.string().default(""),
  error: z.string().optional(),
  next: z.string().optional(),
  reset: z.string().optional(),
  signup: z.boolean().default(false),
});

const loginGradientSettings = {
  topEnabled: false,
  effectHeight: 100,
} as const;

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
  validateSearch: zodValidator(loginSearchSchema),
});

function LoginPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const signInMutation = useMutation({
    mutationFn: signInWithPassword,
    onError: (error) => {
      setError(error.message);
    },
    onMutate: () => {
      setError(undefined);
    },
    onSuccess: (payload, variables) => {
      if (payload.emailVerificationRequired) {
        // The account exists but isn't verified yet. WorkOS just sent a fresh
        // code; hand off to the verify-email page to complete sign-in.
        const email = payload.email ?? variables.email;
        saveEmailVerificationState({
          email,
          next: searchParams.next,
          pendingAuthenticationToken: payload.pendingAuthenticationToken,
          userId: payload.userId,
        });
        navigate({ search: { email, next: searchParams.next }, to: "/auth/verify-email" });
        return;
      }
      window.location.href = payload.redirectTo ?? "/studio";
    },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    signInMutation.mutate({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      returnPathname: searchParams.next,
    });
  };

  const oauthUrl = () => {
    const params = new URLSearchParams({ returnPathname: searchParams.next ?? "/studio" });
    return `/api/auth/oauth/github?${params.toString()}`;
  };

  return (
    <div className="relative grid min-h-svh overflow-hidden bg-background lg:grid-cols-12">
      <VoidhashGradientBackground
        className="absolute inset-0"
        controlsQueryParam="loginGradientControls"
        controlsStorageKey="voidhash:login-gradient-controls"
        controlsTitle="Login FX"
        fadeToBlack={false}
        lenticular
        settings={loginGradientSettings}
        settingsStorageKey="voidhash:login-gradient-settings"
      />
      <div className="relative z-10 col-span-6 flex flex-col gap-4 bg-background/95 p-6 backdrop-blur-xl md:p-10 lg:border-r lg:border-border/50">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link className="flex gap-2 font-medium" to="/">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-start gap-2 text-left">
              <h1 className=" text-3xl">Welcome back!</h1>
            </div>
            <form className="flex flex-col gap-6 mt-10" onSubmit={handleSubmit}>
              {(error || searchParams.error === "oauth_failed") && (
                <div className="mb-6">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Sign-in failed</AlertTitle>
                    <AlertDescription>
                      {error ?? "We could not complete the OAuth sign-in."}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {searchParams.error === "insufficient_permissions" && (
                <div className="mb-6">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                      You don&apos;t have permission to access the requested page.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              {searchParams.signup && (
                <div className="mb-6">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Your account was successfully created</AlertTitle>
                    <AlertDescription>You can now login to your account</AlertDescription>
                  </Alert>
                </div>
              )}

              {searchParams.reset === "success" && (
                <div className="mb-6">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Password updated</AlertTitle>
                    <AlertDescription>Sign in with your new password.</AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    autoComplete="email"
                    defaultValue={searchParams.email}
                    id="email"
                    name="email"
                    placeholder="name@example.com"
                    required
                    size={"lg"}
                    type="email"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    autoComplete="current-password"
                    id="password"
                    name="password"
                    required
                    size={"lg"}
                    type="password"
                  />
                </div>
                <Button
                  className="w-full cursor-pointer"
                  disabled={signInMutation.isPending}
                  type="submit"
                  size={"lg"}
                >
                  {signInMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
                <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-accent after:border-t">
                  <span className="relative z-10 bg-background px-2 text-muted-foreground">OR</span>
                </div>
                <div className="flex flex-col gap-4">
                  <Button
                    asChild
                    className="w-full cursor-pointer"
                    disabled={signInMutation.isPending}
                    size={"lg"}
                    type="button"
                    variant="outline"
                  >
                    <a href={oauthUrl()}>
                      <svg
                        aria-label="Github"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <title>Github Icon</title>
                        <path
                          d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                          fill="currentColor"
                        />
                      </svg>
                      Continue with Github
                    </a>
                  </Button>
                </div>
              </div>
            </form>

            <div className="text-center text-sm mt-8">
              New to Voidhash?{" "}
              <Link
                className="text-muted-foreground text-sm hover:text-foreground underline underline-offset-4"
                search={{ next: searchParams.next }}
                to="/auth/sign-up"
              >
                Sign up
              </Link>
            </div>

            <div className="text-center mt-6">
              <Link
                className="text-muted-foreground text-sm hover:text-foreground underline  underline-offset-4"
                to="/auth/forgot-password"
              >
                Forgot your password?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
