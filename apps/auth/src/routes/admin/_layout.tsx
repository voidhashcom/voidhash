import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { authClient } from '../../lib/auth-client';

export const Route = createFileRoute('/admin/_layout')({
  component: AdminLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.session) {
      throw redirect({
        to: '/login',
        search: {
          next: '/admin'
        }
      });
    }

    // Check if user has admin permissions
    const { data: hasPermission } = await authClient.admin.hasPermission({
      permissions: {
        user: ['list']
      }
    });

    if (!hasPermission) {
      throw redirect({
        to: '/'
      });
    }
  }
});

function AdminLayout() {
  return (
    <div className="min-h-svh bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="font-bold text-3xl">OIDC Admin</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Manage OAuth clients for single sign-on
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
