import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { DOCS_PATH } from "@/lib/paths";

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
  head: () => ({
    links: [
      {
        href: `${DOCS_PATH}/favicon.ico`,
        rel: "icon",
        type: "image/x-icon",
      },
      {
        href: `${DOCS_PATH}/apple-icon.png`,
        rel: "apple-touch-icon",
      },
    ],
    meta: [
      { title: "Voidhash Docs" },
      {
        content: "Documentation for the Voidhash platform.",
        name: "description",
      },
    ],
  }),
});

function DocsLayout() {
  return (
    <RootProvider
      search={{
        options: {
          api: `${DOCS_PATH}/api/search`,
        },
      }}
    >
      <Outlet />
    </RootProvider>
  );
}
