import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Logo, SidebarProvider, useIsMobile } from "@voidhash/ui";

import { redirectToSignOut } from "@/features/auth/lib/sign-out";

export const Route = createFileRoute("/studio/_authenticated/_dashboard")({
  // The parent is `ssr: "data-only"` for its auth loader; the dashboard tree
  // itself stays fully client-only.
  ssr: false,
  component: RouteComponent,
});

function RouteComponent() {
  const isMobile = useIsMobile();

  const signOut = () => {
    redirectToSignOut("/");
  };

  return (
    <div className="flex flex-col [--header-height:calc(theme(spacing.12))] has-[div#nav-enviromental-bar]:[--header-height:calc(theme(spacing.24))]">
      <SidebarProvider className="flex flex-col">
        <Outlet />
        {isMobile && (
          <div className="fixed inset-0 right-0 bottom-0 left-0 z-50 flex flex-col items-center justify-center bg-background px-6">
            <Logo className="w-22" />
            <div className="mt-3 text-balance text-center font-semibold text-xl">
              Voidhash is currently not available on mobile,
            </div>
            <div className="mt-3 text-balance text-center text-muted-foreground text-sm">
              Please use a desktop browser to access Voidhash. We are working hard to bring you the
              best experience on mobile.
            </div>
            <div className="mt-6 text-center text-muted-foreground text-sm">
              <button
                className="cursor-pointer text-foreground underline underline-offset-4"
                onClick={signOut}
                type="button"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </SidebarProvider>
    </div>
  );
}
