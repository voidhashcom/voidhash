import { loader } from "fumadocs-core/source";
import * as icons from "lucide-static";

import { design } from "@generated/server";
import { DESIGN_PATH } from "@/lib/paths";

type DesignSource = ReturnType<typeof loader>;

let sourcePromise: Promise<DesignSource> | undefined;

/**
 * Returns the loaded design documentation source. fumadocs-mdx's server runtime
 * builds the collection eagerly (top-level await in the generated
 * `.source/server.ts`), so `toFumadocsSource()` is synchronous here; the promise
 * memoizes the loader.
 */
export const getSource = (): Promise<DesignSource> => {
  sourcePromise ??= Promise.resolve(
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
      source: design.toFumadocsSource(),
    }),
  );

  return sourcePromise;
};
