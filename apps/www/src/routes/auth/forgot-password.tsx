import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
} from "@voidhash/ui";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";

import { AuthHeader, AuthLayout } from "@/features/auth/components/auth-layout";
import { requestPasswordReset } from "@/features/auth/lib/auth-api";

const forgotPasswordSearchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordPage,
  validateSearch: zodValidator(forgotPasswordSearchSchema),
});

function ForgotPasswordPage() {
  const searchParams = Route.useSearch();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [emailSent, setEmailSent] = useState(false);
  const forgotPasswordMutation = useMutation({
    mutationFn: requestPasswordReset,
    onError: (error) => {
      setError(error.message);
    },
    onMutate: () => {
      setError(undefined);
    },
    onSuccess: () => {
      setEmailSent(true);
    },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    forgotPasswordMutation.mutate({ email });
  };

  if (emailSent) {
    return (
      <AuthLayout>
        <AuthHeader
          description={
            <>
              We&apos;ve sent a password reset link to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </>
          }
          title="Check your email"
        />
        <div className="mt-10 flex flex-col gap-6">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertTitle>Didn&apos;t receive the email?</AlertTitle>
            <AlertDescription>
              Check your spam folder or{" "}
              <button
                className="underline underline-offset-4"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
                type="button"
              >
                try another email address
              </button>
            </AlertDescription>
          </Alert>
        </div>
        <div className="mt-8 text-center text-sm">
          <Link
            className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
            search={{ next: searchParams.next }}
            to="/auth/login"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeader
        description="Enter the email address you used to create the account and we'll email you instructions to reset your password."
        title="Forgot password?"
      />
      <form className="mt-10 flex flex-col gap-6" onSubmit={handleSubmit}>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Reset failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
              size="lg"
              type="email"
              value={email}
            />
          </div>
          <Button
            className="w-full cursor-pointer"
            disabled={forgotPasswordMutation.isPending}
            size="lg"
            type="submit"
          >
            {forgotPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {forgotPasswordMutation.isPending ? "Sending..." : "Send reset link"}
          </Button>
        </div>
      </form>
      <div className="mt-8 text-center text-sm">
        <Link
          className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
          search={{ next: searchParams.next }}
          to="/auth/login"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>
    </AuthLayout>
  );
}
