import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Logo,
  Spinner
} from '@voidhash/ui';
import { LogOut, Settings, User } from 'lucide-react';
import { authMiddleware } from 'src/middleware/auth';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/')({
  component: HomePage,
  server: {
    middleware: [authMiddleware]
  }
});

export function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = '/login';
  };

  if (isPending) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Logo />
          </div>

          <Card className="mt-4">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                {user?.image ? (
                  // biome-ignore lint/performance/noImgElement: only a small avatar
                  <img
                    alt={user.name ?? 'User'}
                    className="h-16 w-16 rounded-full object-cover"
                    src={user.image}
                  />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
              </div>
              <CardTitle className="text-xl">
                Welcome, {user?.name ?? 'User'}
              </CardTitle>
              <CardDescription>{user?.email}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground text-sm">
                You are signed in to Voidhash Auth. You can manage your account
                settings or sign out.
              </p>

              <div className="flex flex-col gap-2">
                {user?.role === 'admin' && (
                  <Link to="/admin">
                    <Button className="w-full" variant="outline">
                      <Settings className="mr-2 h-4 w-4" />
                      Admin Panel
                    </Button>
                  </Link>
                )}

                <Button
                  className="w-full"
                  onClick={handleSignOut}
                  variant="destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-muted-foreground text-xs">
            Voidhash Auth - Secure single sign-on for all your applications
          </p>
        </div>
      </div>
    </div>
  );
}
