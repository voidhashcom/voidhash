import { loader } from "fumadocs-core/source";
import * as icons from "lucide-static";

import { docs } from "@generated/docs";
import { createViteSource } from "@/lib/create-vite-source";
import { DOCS_PATH } from "@/lib/paths";

type DocsSource = ReturnType<typeof loader>;

let sourcePromise: Promise<DocsSource> | undefined;

/**
 * Returns the loaded documentation source without evaluating MDX imports at module load.
 */
export const getSource = (): Promise<DocsSource> => {
  sourcePromise ??= createViteSource(docs.doc, docs.meta).then((docsSource) =>
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
      source: docsSource,
    }),
  );

  return sourcePromise;
};
