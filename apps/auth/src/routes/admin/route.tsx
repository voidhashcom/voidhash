import { Outlet, createFileRoute } from "@tanstack/react-router";

import { authAdminMiddleware } from "../../middleware/auth-admin";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  server: {
    middleware: [authAdminMiddleware],
  },
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
