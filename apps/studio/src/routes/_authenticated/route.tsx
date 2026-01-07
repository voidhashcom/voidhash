import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthProvider } from "src/components/auth-context";

import { authClient } from "@/lib/auth-client";
import { currentUserOptions } from "@/lib/tanstack-query";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(currentUserOptions());
      // biome-ignore lint/suspicious/noExplicitAny: TODO: Add typesafe error handling
    } catch (error: any) {
      if (error.failure._tag === "AuthenticationError") {
        // window.location.href = `${env.VITE_APP_AUTH_BASE_URL}/auth/login?next=${env.VITE_APP_STUDIO_BASE_URL}${window.location.pathname}`;

        const redirectUrl = await authClient.signIn.social({
          provider: "voidhash-auth",
        });

        if (!redirectUrl.error && redirectUrl.data.url) {
          // throw redirect({
          //   to: redirectUrl.data.url
          // });
          window.location.href = redirectUrl.data.url;
        }

        if (redirectUrl.error) {
          throw redirectUrl.error;
        }
      }
      // TODO: Handle error and redirect to login
      // console.log(JSON.stringify(error, null, 2));
    }

    // if (
    //   !(session.data || session.error) ||
    //   (session.error && session.error.code === 'UNAUTHORIZED')
    // ) {
    //   const redirectUrl = await authClient.signIn.social({
    //     provider: 'voidhash-auth'
    //   });

    //   if (!redirectUrl.error && redirectUrl.data.url) {
    //     throw redirect({
    //       to: redirectUrl.data.url
    //     });
    //   }

    //   if (redirectUrl.error) {
    //     throw redirectUrl.error;
    //   }
    // }

    // if (session.error) {
    //   throw session.error;
    // }
  },
  component: RouteComponent,
  // pendingComponent: () => (
  //   <div className="flex h-screen w-screen items-center justify-center">
  //     <Spinner />
  //   </div>
  // )
});

function RouteComponent() {
  const { data } = useSuspenseQuery(currentUserOptions());
  return (
    <AuthProvider user={data}>
      <Outlet />
    </AuthProvider>
  );
}
