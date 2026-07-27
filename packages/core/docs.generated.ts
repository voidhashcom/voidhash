/// <reference types="vite/client" />
import { fromConfig } from "fumadocs-mdx/runtime/vite";
import type * as Config from "./src/features/docs/source.config";

export const create = fromConfig<typeof Config>();

export const docs = {
  doc: create.doc(
    "docs",
    "./src/features/docs/content/docs",
    import.meta.glob(["./**/*.{mdx,md}"], {
      base: "./src/features/docs/content/docs",
      query: {
        collection: "docs",
      },
    }),
  ),
  meta: create.meta(
    "docs",
    "./src/features/docs/content/docs",
    import.meta.glob(["./**/*.{json,yaml}"], {
      import: "default",
      base: "./src/features/docs/content/docs",
      query: {
        collection: "docs",
      },
    }),
  ),
};
