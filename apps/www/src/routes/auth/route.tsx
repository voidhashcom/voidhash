import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AUTH_PATH } from "@/lib/paths";

export const Route = createFileRoute("/auth")({
  component: Outlet,
  head: () => ({
    links: [
      {
        href: `${AUTH_PATH}/favicon.ico`,
        rel: "icon",
        type: "image/x-icon",
      },
      {
        href: `${AUTH_PATH}/apple-icon.png`,
        rel: "apple-touch-icon",
      },
    ],
    meta: [
      { title: "Voidhash Auth" },
      {
        content: "Authentication and account management for Voidhash.",
        name: "description",
      },
    ],
  }),
});
