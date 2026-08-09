import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from "../fumadocs-config.ts";
import { voidhashShikiDark, voidhashShikiLight } from "./lib/shiki-theme.ts";

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  dir: "src/features/docs/content/docs",
  docs: {
    schema: frontmatterSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // MDX options
    remarkNpmOptions: {
      persist: {
        id: "package-manager",
      },
    },
    valueToExport: ["elementIds", "toc"],
    // Highlight code with the Voidhash themes so docs snippets match the paywall
    // designer's Monaco editor. Keys stay `light`/`dark` so fumadocs' existing
    // `--shiki-light`/`--shiki-dark` CSS switching keeps working.
    rehypeCodeOptions: {
      themes: {
        light: voidhashShikiLight,
        dark: voidhashShikiDark,
      },
    },
  },
});
