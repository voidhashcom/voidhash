import { Outlet, createFileRoute } from "@tanstack/react-router";

import { STUDIO_PATH } from "@/lib/paths";

export const Route = createFileRoute("/studio")({
  component: Outlet,
  head: () => ({
    links: [
      {
        href: `${STUDIO_PATH}/favicon.ico`,
        rel: "icon",
        type: "image/x-icon",
      },
      {
        href: `${STUDIO_PATH}/apple-icon.png`,
        rel: "apple-touch-icon",
      },
    ],
    meta: [
      { title: "Voidhash Studio" },
      {
        content: "Voidhash Studio for managing projects, paywalls, and products.",
        name: "description",
      },
    ],
  }),
});
