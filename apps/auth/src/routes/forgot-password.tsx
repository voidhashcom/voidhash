import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Logo
} from '@voidhash/ui';
import { ArrowLeft, CheckCircle, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage
});

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password'
      });

      if (error) {
        toast.error(error.message ?? 'An error occurred. Please try again.');
        setLoading(false);
        return;
      }

      setEmailSent(true);
    } catch (_error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
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
                <CardTitle className="text-2xl">Check your email</CardTitle>
                <CardDescription>
                  We&apos;ve sent a password reset link to{' '}
                  <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertTitle>Didn&apos;t receive the email?</AlertTitle>
                  <AlertDescription>
                    Check your spam folder or{' '}
                    <button
                      className="underline underline-offset-4"
                      onClick={() => {
                        setEmailSent(false);
                        setEmail('');
                      }}
                      type="button"
                    >
                      try another email address
                    </button>
                  </AlertDescription>
                </Alert>
                <div className="text-center">
                  <Link
                    className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
                    to="/login"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </Link>
                </div>
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
              <CardTitle className="text-2xl">Forgot password?</CardTitle>
              <CardDescription>
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    autoComplete="email"
                    id="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <Button className="w-full" disabled={loading} type="submit">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
                <div className="text-center">
                  <Link
                    className="inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
                    to="/login"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
