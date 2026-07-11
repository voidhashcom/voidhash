import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  Alert,
  AlertDescription,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@voidhash/ui";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthHeader, AuthLayout } from "@/features/auth/components/auth-layout";
import { resetPassword } from "@/features/auth/lib/auth-api";

const resetPasswordSearchSchema = z.object({
  next: z.string().optional(),
  token: z.string().optional(),
});

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordPage,
  validateSearch: zodValidator(resetPasswordSearchSchema),
});

const resetPasswordSchema = z
  .object({
    confirmPassword: z.string(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

function ResetPasswordPage() {
  const searchParams = Route.useSearch();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetPasswordForm>({
    defaultValues: {
      confirmPassword: "",
      password: "",
    },
    resolver: zodResolver(resetPasswordSchema),
  });

  const { token } = searchParams;

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onError: (error) => {
      if (error.message.includes("expired")) {
        setError("This password reset link has expired. Please request a new one.");
      } else {
        setError(error.message);
      }
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: () => {
      setSuccess(true);
    },
  });

  const onSubmit = (data: ResetPasswordForm) => {
    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    resetPasswordMutation.mutate({
      password: data.password,
      token,
    });
  };

  if (!token) {
    return (
      <AuthLayout>
        <AuthHeader
          description="This password reset link is invalid or has expired. Please request a new password reset."
          title="Invalid link"
        />
        <div className="mt-10">
          <Button asChild className="w-full cursor-pointer" size="lg" variant="outline">
            <Link search={{ next: searchParams.next }} to="/auth/forgot-password">
              Request new reset link
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <AuthHeader
          description="Your password has been reset successfully. You can now sign in with your new password."
          title="Password reset!"
        />
        <div className="mt-10">
          <Button asChild className="w-full cursor-pointer" size="lg">
            <Link search={{ next: searchParams.next }} to="/auth/login">
              Continue to login
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeader
        description="Enter your new password below. Make sure it's at least 8 characters and includes uppercase, lowercase, and a number."
        title="Reset your password"
      />
      <Form {...form}>
        <form className="mt-10 flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input autoComplete="new-password" size="lg" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input autoComplete="new-password" size="lg" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="w-full cursor-pointer"
              disabled={resetPasswordMutation.isPending}
              size="lg"
              type="submit"
            >
              {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset password"}
            </Button>
          </div>
        </form>
      </Form>
    </AuthLayout>
  );
}
