/** biome-ignore-all lint/style/noHeadElement: Head element is required for Tanstack Router */
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ThemeProviderTanstack } from "@voidhash/ui";

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
    ],
    meta: [
      { charSet: "utf8" },
      {
        content: "width=device-width, initial-scale=1",
        name: "viewport",
      },
      { title: "Voidhash - The mobile app monetization and insights platform" },
      {
        content:
          "Voidhash is an monetization and insights platform simplifying integrations, analytics, and revenue growth for apps and digital products.",
        name: "description",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <RootDocument>
      <ThemeProviderTanstack
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
        suppressHydrationWarning
      >
        <Outlet />
      </ThemeProviderTanstack>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
