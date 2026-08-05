import { defineConfig, defineDocs, frontmatterSchema, metaSchema } from "./fumadocs-config.ts";
import { voidhashShikiDark, voidhashShikiLight } from "./docs/lib/shiki-theme.ts";

// A host that adds documentation surfaces of its own replaces this config
// wholesale rather than registering a second `mdx()` plugin — two instances
// writing the same output directory clobber each other. See
// `apps/www/src/features/source.config.ts` in voidhash-mono, which re-declares
// this collection alongside its own.
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
