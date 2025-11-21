'use client';

import { authClient } from '@voidhash/auth/client';
import { Logo, SidebarProvider, useIsMobile } from '@voidhash/ui';
import { useCurrentUser } from 'hooks/tanstack-query';
import { usePathname, useRouter } from 'next/navigation';
import { nextRenderRedirect } from '@/lib/nextjs';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, error: currentUserError } = useCurrentUser();

  const isSettingsRoute = pathname.includes('/settings');
  const isMobile = useIsMobile();

  const signOut = async () => {
    await authClient.signOut();
    router.refresh();
    router.push('/');
  };

  if (status === 'error') {
    currentUserError.match({
      NotAuthenticatedError: () => {
        nextRenderRedirect(router, '/login');
      },
      AuthenticationError: () => {
        nextRenderRedirect(router, '/login');
      },
      OrElse: () => {
        return null;
      }
    });
  }

  return (
    <div className="flex flex-col [--header-height:calc(theme(spacing.14))] has-[div#nav-enviromental-bar]:[--header-height:calc(theme(spacing.24))]">
      <SidebarProvider className="flex flex-col" defaultOpen={!isSettingsRoute}>
        {children}
        {isMobile && (
          <div className="fixed inset-0 right-0 bottom-0 left-0 z-50 flex flex-col items-center justify-center bg-background px-6">
            <Logo className="w-22" />
            <div className="mt-3 text-balance text-center font-semibold text-xl">
              Voidhash is currently not available on mobile,
            </div>
            <div className="mt-3 text-balance text-center text-muted-foreground text-sm">
              Please use a desktop browser to access Voidhash. We are working
              hard to bring you the best experience on mobile.
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
