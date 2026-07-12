/** biome-ignore-all lint/style/noHeadElement: Head element is required for TanStack Router */
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import {
  AuthKitProvider,
  useAccessToken,
} from "@workos/authkit-tanstack-react-start/client";
import { ThemeProviderTanstack, Toaster } from "@voidhash/ui";
import { useEffect } from "react";

import { setBrowserAccessTokenProvider } from "@/lib/effect-query";
import appCss from "@/styles/globals.css?url";

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
        <AuthKitProvider>
          <ThemeProviderTanstack
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
            // enableSystem
            suppressHydrationWarning
          >
            <WorkOsAccessTokenBridge />
            <Outlet />
            <Toaster />
          </ThemeProviderTanstack>
        </AuthKitProvider>
        <Scripts />
      </body>
    </html>
  );
}

function WorkOsAccessTokenBridge() {
  const { getAccessToken } = useAccessToken();

  if (!import.meta.env.SSR) {
    setBrowserAccessTokenProvider(async () => (await getAccessToken()) ?? undefined);
  }

  useEffect(
    () => () => {
      if (!import.meta.env.SSR) {
        setBrowserAccessTokenProvider(undefined);
      }
    },
    [],
  );

  return null;
}
