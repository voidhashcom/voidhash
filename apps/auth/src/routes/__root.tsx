/** biome-ignore-all lint/style/noHeadElement: Head element is required for Tanstack Router */
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { ThemeProviderTanstack, Toaster } from "@voidhash/ui";

import appCss from "../globals.css?url";

export const Route = createRootRoute({
  component: RootLayout,
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

function RootLayout() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <ThemeProviderTanstack
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <Outlet />
          <Toaster />
        </ThemeProviderTanstack>
        <Scripts />
      </body>
    </html>
  );
}
