/** Head element is required for TanStack Router */
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { ThemeProviderTanstack, Toaster } from "@voidhash/ui";
import { useEffect } from "react";

import {
  AuthProvider,
  resetBrowserAccessToken,
  useBrowserAccessTokenProvider,
} from "virtual:voidhash-web/auth-browser";
import { setBrowserAccessTokenProvider } from "@/lib/effect-query";
import appCss from "virtual:voidhash-web/globals.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
  head: () => ({
    links: [
      {
        href: appCss,
        rel: "stylesheet",
      },
      {
        href: "/favicon.ico",
        rel: "icon",
        type: "image/x-icon",
      },
      {
        href: "/apple-icon.png",
        rel: "apple-touch-icon",
      },
    ],
    meta: [
      { charSet: "utf8" },
      {
        content: "width=device-width, initial-scale=1",
        name: "viewport",
      },
      { title: "Voidhash" },
      {
        content:
          "Voidhash is an open-source subscription management platform simplifying integrations, analytics, and revenue growth for apps and digital products.",
        name: "description",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="text-pretty antialiased bg-sidebar">
        <AuthProvider>
          <ThemeProviderTanstack
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
            // enableSystem
            suppressHydrationWarning
          >
            <AccessTokenBridge />
            <Outlet />
            <Toaster />
          </ThemeProviderTanstack>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Supplies the browser RPC client's bearer credential from whichever identity
 * provider the deployment runs, without the root route needing to know which
 * one that is (a root loader would make every navigation depend on it, and the
 * answer is a deployment constant).
 */
function AccessTokenBridge() {
  const getAccessToken = useBrowserAccessTokenProvider();

  if (!import.meta.env.SSR) {
    setBrowserAccessTokenProvider(getAccessToken);
  }

  useEffect(
    () => () => {
      if (!import.meta.env.SSR) {
        setBrowserAccessTokenProvider(undefined);
        resetBrowserAccessToken();
      }
    },
    [],
  );

  return null;
}
