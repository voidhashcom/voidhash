import { zodResolver } from "@hookform/resolvers/zod";
import { Link, createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Logo,
} from "@voidhash/ui";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "../lib/auth-client";

const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
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
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const searchParams = Route.useSearch();
  const [loading, setLoading] = useState(false);
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

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: data.password,
        token,
      });

      if (resetError) {
        if (resetError.message?.includes("expired")) {
          setError(
            "This password reset link has expired. Please request a new one."
          );
        } else {
          setError(
            resetError.message ?? "An error occurred. Please try again."
          );
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("Password reset successfully!");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
              <Link to="/login">
                <Logo />
              </Link>
            </div>
            <Card className="mt-4">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle className="text-2xl">Invalid Link</CardTitle>
                <CardDescription>
                  This password reset link is invalid or has expired. Please
                  request a new password reset.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link className="w-full" to="/forgot-password">
                  <Button className="w-full" variant="outline">
                    Request new reset link
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
              <Link to="/login">
                <Logo />
              </Link>
            </div>
            <Card className="mt-4">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-2xl">Password Reset!</CardTitle>
                <CardDescription>
                  Your password has been reset successfully. You can now log in
                  with your new password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link className="w-full" to="/login">
                  <Button className="w-full">Continue to Login</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Link to="/login">
              <Logo />
            </Link>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-2xl">Reset your password</CardTitle>
              <CardDescription>
                Enter your new password below. Make sure it&apos;s at least 8
                characters and includes uppercase, lowercase, and a number.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  className="space-y-6"
                  onSubmit={form.handleSubmit(onSubmit)}
                >
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="new-password"
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="new-password"
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button className="w-full" disabled={loading} type="submit">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
