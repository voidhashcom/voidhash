import { loader } from "fumadocs-core/source";
import * as icons from "lucide-static";

import { docs } from "@generated/design";
import { createViteSource } from "@/lib/create-vite-source";
import { DESIGN_PATH } from "@/lib/paths";

type DesignSource = ReturnType<typeof loader>;

let sourcePromise: Promise<DesignSource> | undefined;

/**
 * Returns the loaded design documentation source without evaluating MDX imports at module load.
 */
export const getSource = (): Promise<DesignSource> => {
  sourcePromise ??= createViteSource(docs.doc, docs.meta).then((docsSource) =>
    loader({
      baseUrl: DESIGN_PATH,
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
