import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { DatabaseProvider } from "@/components/database-context";

export const Route = createFileRoute("/_app/_layout")({
  component: LayoutRoute,
});

function LayoutRoute() {
  return (
    <DatabaseProvider>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </DatabaseProvider>
  );
}
