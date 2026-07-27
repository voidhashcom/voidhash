import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { DESIGN_PATH } from "@/lib/paths";

export const Route = createFileRoute("/design")({
  component: DesignLayout,
  head: () => ({
    links: [
      {
        href: `${DESIGN_PATH}/favicon.ico`,
        rel: "icon",
        type: "image/x-icon",
      },
      {
        href: `${DESIGN_PATH}/apple-icon.png`,
        rel: "apple-touch-icon",
      },
    ],
    meta: [
      { title: "Voidhash Design System" },
      {
        content: "Design system documentation for Voidhash UI components.",
        name: "description",
      },
    ],
  }),
});

function DesignLayout() {
  return (
    <RootProvider
      search={{
        options: {
          api: `${DESIGN_PATH}/api/search`,
        },
      }}
    >
      <Outlet />
    </RootProvider>
  );
}
