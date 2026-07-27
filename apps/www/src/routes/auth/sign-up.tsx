import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Logo,
} from "@voidhash/ui";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v3";

import { AuthLenticularBackground } from "@/features/auth/components/auth-lenticular-background";
import { signUpWithPassword } from "@/features/auth/lib/auth-api";
import { saveEmailVerificationState } from "@/features/auth/lib/email-verification-storage";
import { provisionCurrentUser } from "@/features/auth/lib/provision-user";
import { WAITLIST_MODE } from "@/lib/waitlist";

const signUpSearchSchema = z.object({
  email: z.string().optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUpPage,
  validateSearch: zodValidator(signUpSearchSchema),
});

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    ),
});

type SignUpForm = z.infer<typeof signUpSchema>;

const splitName = (name: string) => {
  const [firstName = "", ...lastNameParts] = name.trim().split(/\s+/);

  return {
    firstName,
    lastName: lastNameParts.join(" "),
  };
};

function SignUpPage() {
  const [error, setError] = useState<string>();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const form = useForm<SignUpForm>({
    defaultValues: {
      email: searchParams.email ?? "",
      name: "",
      password: "",
    },
    resolver: zodResolver(signUpSchema),
  });

  const signUpMutation = useMutation({
    mutationFn: signUpWithPassword,
    onError: (error) => {
      setError(error.message);
    },
    onMutate: () => {
      setError(undefined);
    },
    onSuccess: async (payload, variables) => {
      if (payload.emailVerificationRequired) {
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
      // Eagerly create the local user record in the backend before landing on
      // the dashboard, so its first load is a plain read rather than a
      // write-on-read.
      await provisionCurrentUser();
      window.location.href = payload.redirectTo ?? "/studio";
    },
  });

  const onSubmit = (data: SignUpForm) => {
    const { firstName, lastName } = splitName(data.name);

    signUpMutation.mutate({
      email: data.email,
      firstName,
      lastName,
      password: data.password,
      returnPathname: searchParams.next,
    });
  };

  const oauthUrl = () => {
    const params = new URLSearchParams({ returnPathname: searchParams.next ?? "/studio" });
    return `/api/auth/oauth/github?${params.toString()}`;
  };

  const isSubmitting = signUpMutation.isPending || signUpMutation.isSuccess;

  return (
    <div className="relative grid min-h-svh overflow-hidden bg-background lg:grid-cols-12">
      <AuthLenticularBackground className="absolute inset-0" />
      <div className="relative z-10 col-span-8 flex flex-col gap-4 p-6 md:p-10 bg-linear-to-r from-background to-transparent">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link className="flex gap-2 font-medium" to="/">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-start gap-2 text-left">
              <h1 className=" text-3xl">
                {WAITLIST_MODE ? "Join the waitlist" : "Create your account"}
              </h1>
              {WAITLIST_MODE && (
                <p className="text-muted-foreground">
                  Create your account to claim your spot. We're onboarding new teams in batches and
                  will email you as soon as it's your turn.
                </p>
              )}
            </div>
            <Form {...form}>
              <form className="flex flex-col gap-6 mt-10" onSubmit={form.handleSubmit(onSubmit)}>
                {error && (
                  <div className="mb-6">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Sign-up failed</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </div>
                )}

                <div className="grid gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" size="lg" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" size="lg" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input size="lg" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    className="w-full cursor-pointer"
                    disabled={isSubmitting}
                    size="lg"
                    type="submit"
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Continue
                  </Button>
                  <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-accent after:border-t">
                    <span className="relative z-10 bg-background px-2 text-muted-foreground">
                      OR
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    <Button
                      asChild
                      className="w-full cursor-pointer"
                      disabled={signUpMutation.isPending}
                      size="lg"
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
            </Form>
            <div className="text-center text-sm mt-8">
              Already have an account?{" "}
              <Link
                className="text-muted-foreground text-sm hover:text-foreground underline underline-offset-4"
                search={{ next: searchParams.next }}
                to="/auth/login"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
