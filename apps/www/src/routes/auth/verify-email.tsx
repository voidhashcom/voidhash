import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@voidhash/ui";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { AuthHeader, AuthLayout } from "@/features/auth/components/auth-layout";
import { resendVerificationCode, verifyEmailCode } from "@/features/auth/lib/auth-api";
import {
  clearEmailVerificationState,
  loadEmailVerificationState,
} from "@/features/auth/lib/email-verification-storage";
import { provisionCurrentUser } from "@/features/auth/lib/provision-user";

const verifyEmailSearchSchema = z.object({
  email: z.string().optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth/verify-email")({
  component: VerifyEmailPage,
  validateSearch: zodValidator(verifyEmailSearchSchema),
});

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const OTP_SLOTS = Array.from({ length: CODE_LENGTH }, (_, index) => index);

function VerifyEmailPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  // The pending token + user id are written to sessionStorage by the sign-up /
  // sign-in flow. They survive a refresh but are intentionally lost when the tab
  // closes — at which point the user signs in again to restart with a fresh code.
  const stored = useMemo(() => loadEmailVerificationState(), []);
  const email = stored?.email ?? searchParams.email ?? "";
  const next = stored?.next ?? searchParams.next;
  const pendingAuthenticationToken = stored?.pendingAuthenticationToken;
  const userId = stored?.userId;

  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: verifyEmailCode,
    onError: (mutationError) => {
      setError(mutationError.message);
      setCode("");
    },
    onMutate: () => {
      setError(undefined);
      setInfo(undefined);
    },
    onSuccess: async (payload) => {
      clearEmailVerificationState();
      if (payload.redirectTo) {
        // Verified with a session — eagerly create the local user record in the
        // backend before landing in the app, so the first dashboard load is a
        // plain read rather than a write-on-read.
        await provisionCurrentUser();
        window.location.href = payload.redirectTo;
        return;
      }
      // Verified without a session (no pending token) — send them to sign in.
      navigate({ search: { email, next }, to: "/auth/login" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: resendVerificationCode,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onMutate: () => {
      setError(undefined);
      setInfo(undefined);
    },
    onSuccess: () => {
      setInfo(`We sent a new code to ${email || "your email"}.`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    },
  });

  const submitCode = (value: string) => {
    if (value.length !== CODE_LENGTH || verifyMutation.isPending) {
      return;
    }
    verifyMutation.mutate({
      code: value,
      email,
      pendingAuthenticationToken,
      returnPathname: next,
    });
  };

  // Without an email or a pending token there is nothing to verify against
  // (e.g. the page was opened directly). Point the user back to sign in.
  const hasContext = Boolean(email || pendingAuthenticationToken);

  if (!hasContext) {
    return (
      <AuthLayout>
        <AuthHeader
          description="Sign in with your email and password and we'll send you a fresh verification code."
          title="Verify your email"
        />
        <div className="mt-10">
          <Button asChild className="w-full cursor-pointer" size="lg">
            <Link search={{ next }} to="/auth/login">
              Go to sign in
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeader
        description={
          <>
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium text-foreground">{email || "your email"}</span>.
          </>
        }
        title="Check your email"
      />
      <div className="mt-10 flex flex-col gap-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Verification failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {info && (
          <Alert>
            <MailCheck className="h-4 w-4" />
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            submitCode(code);
          }}
        >
          <InputOTP
            autoFocus
            disabled={verifyMutation.isPending}
            maxLength={CODE_LENGTH}
            onChange={setCode}
            onComplete={submitCode}
            value={code}
          >
            <InputOTPGroup>
              {OTP_SLOTS.map((slot) => (
                <InputOTPSlot index={slot} key={slot} />
              ))}
            </InputOTPGroup>
          </InputOTP>

          <Button
            className="w-full cursor-pointer"
            disabled={
              verifyMutation.isPending ||
              verifyMutation.isSuccess ||
              code.length !== CODE_LENGTH
            }
            size="lg"
            type="submit"
          >
            {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {verifyMutation.isPending ? "Verifying..." : "Verify email"}
          </Button>
        </form>

        <div className="text-muted-foreground text-sm">
          Didn&apos;t get a code?{" "}
          <button
            className="text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={resendMutation.isPending || cooldown > 0}
            onClick={() => resendMutation.mutate({ email, userId })}
            type="button"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-sm">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground underline underline-offset-4"
          search={{ next }}
          to="/auth/login"
        >
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
