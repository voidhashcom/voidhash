/** biome-ignore-all lint/style/noHeadElement: Head element is required for Tanstack Router */
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts
} from '@tanstack/react-router';
import { ThemeProviderTanstack } from '@voidhash/ui';
import appCss from '@/styles/globals.css?url';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      },
      { title: 'Voidhash - The mobile app monetization and insights platform' },
      {
        name: 'description',
        content:
          'Voidhash is an monetization and insights platform simplifying integrations, analytics, and revenue growth for apps and digital products.'
      }
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss
      }
    ]
  }),
  component: RootComponent
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
