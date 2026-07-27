import { loader } from "fumadocs-core/source";
import * as icons from "lucide-static";

import { docs } from "@generated/server";
import { DOCS_PATH } from "@/lib/paths";

type DocsSource = ReturnType<typeof loader>;

let sourcePromise: Promise<DocsSource> | undefined;

/**
 * Returns the loaded documentation source. fumadocs-mdx's server runtime builds
 * the collection eagerly (top-level await in the generated `.source/server.ts`),
 * so `toFumadocsSource()` is synchronous here; the promise memoizes the loader.
 */
export const getSource = (): Promise<DocsSource> => {
  sourcePromise ??= Promise.resolve(
    loader({
      baseUrl: DOCS_PATH,
      icon(icon) {
        if (!icon) {
          return;
        }

        if (icon in icons) {
          return icons[icon as keyof typeof icons] as unknown as React.ReactElement;
        }
      },
      source: docs.toFumadocsSource(),
    }),
  );

  return sourcePromise;
};
