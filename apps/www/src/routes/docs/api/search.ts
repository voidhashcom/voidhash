import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";

import { getSource } from "@/features/docs/lib/source";

let searchApiPromise: Promise<ReturnType<typeof createFromSource>> | undefined;

const getSearchApi = (): Promise<ReturnType<typeof createFromSource>> => {
  searchApiPromise ??= getSource().then(createFromSource);
  return searchApiPromise;
};

export const Route = createFileRoute("/docs/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => (await getSearchApi()).GET(request),
    },
  },
});
