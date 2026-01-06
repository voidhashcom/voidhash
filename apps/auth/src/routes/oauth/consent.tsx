import { createFileRoute, Link } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Logo
} from '@voidhash/ui';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Shield,
  XCircle
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { authClient } from '../../lib/auth-client';

const consentSearchSchema = z.object({
  client_id: z.string().optional(),
  scope: z.string().optional(),
  redirect_uri: z.string().optional(),
  state: z.string().optional(),
  response_type: z.string().optional()
});

export const Route = createFileRoute('/oauth/consent')({
  component: ConsentPage,
  validateSearch: zodValidator(consentSearchSchema)
});

function ConsentPageContent() {
  const searchParams = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const clientId = searchParams.client_id;
  const scope = searchParams.scope;
  const redirectUri = searchParams.redirect_uri;
  const state = searchParams.state;

  const scopes = scope?.split(' ') ?? [];

  const getScopeDescription = (scopeName: string) => {
    const descriptions: Record<string, string> = {
      openid: 'Verify your identity',
      profile: 'Access your profile information (name, picture)',
      email: 'Access your email address',
      offline_access:
        'Stay signed in and access your data when you are not using the app'
    };
    return descriptions[scopeName] ?? scopeName;
  };

  const handleErrorRedirect = (errorCode: string, errorDescription: string) => {
    if (redirectUri) {
      try {
        const url = new URL(redirectUri);
        url.searchParams.set('error', errorCode);
        url.searchParams.set('error_description', errorDescription);
        if (state) {
          url.searchParams.set('state', state);
        }
        setIsRedirecting(true);
        window.location.href = url.toString();
      } catch {
        // Invalid redirect URI, show error in page
        setError(
          'Unable to redirect back to application. Invalid redirect URI.'
        );
      }
    } else {
      setError(errorDescription);
    }
  };

  const handleConsent = async (accept: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authClient.oauth2.consent({
        accept,
        scope: accept ? scope : undefined
      });

      if (response.error) {
        setLoading(false);
        const errorMessage =
          response.error.message ?? 'Failed to process authorization request.';
        toast.error(errorMessage);
        setError(errorMessage);
        return;
      }

      if (response.data?.uri) {
        setIsRedirecting(true);
        window.location.href = response.data.uri;
      } else if (accept) {
        // No redirect URI returned when accepting, this shouldn't happen
        setLoading(false);
        setError(
          'Authorization was processed but no redirect was provided. Please try again.'
        );
      } else {
        // User denied, redirect with access_denied error
        handleErrorRedirect(
          'access_denied',
          'User denied the authorization request'
        );
      }
    } catch (_error) {
      setLoading(false);
      const errorMessage =
        'An unexpected error occurred. Please try again or contact support.';
      toast.error(errorMessage);
      setError(errorMessage);
    }
  };

  if (isRedirecting) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive text-xl">
              Invalid Request
            </CardTitle>
            <CardDescription>
              The authorization request is missing required parameters. This may
              be a configuration error with the application.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col gap-4">
            <Link className="w-full" to="/login">
              <Button className="w-full" variant="outline">
                Return to Login
              </Button>
            </Link>
            <p className="text-center text-muted-foreground text-xs">
              If this problem persists, please contact support@voidhash.com
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Link to="/">
              <Logo />
            </Link>
          </div>

          <Card className="mt-4">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Authorize Application</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">{clientId}</span>{' '}
                wants to access your account
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-3 font-medium text-sm">
                  This application will be able to:
                </p>
                <ul className="space-y-2">
                  {scopes.map((scopeName) => (
                    <li
                      className="flex items-center gap-2 text-muted-foreground text-sm"
                      key={scopeName}
                    >
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {getScopeDescription(scopeName)}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex gap-3">
              <Button
                className="flex-1"
                disabled={loading}
                onClick={() => handleConsent(false)}
                variant="outline"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Deny
              </Button>
              <Button
                className="flex-1"
                disabled={loading}
                onClick={() => handleConsent(true)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Allow
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <p className="text-center text-muted-foreground text-xs">
            By authorizing, you allow this application to access your data as
            described above.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ConsentPage() {
  return <ConsentPageContent />;
}
