import { defineConfig, defineDocs, frontmatterSchema, metaSchema } from "./fumadocs-config.ts";
import { voidhashShikiDark, voidhashShikiLight } from "./docs/lib/shiki-theme.ts";

// Both documentation surfaces (product docs + design system) are declared as
// collections in a single config so fumadocs-mdx emits one `.source` runtime
// bundle. Keeping them in one config avoids running two `mdx()` plugin
// instances against the same output directory (which would clobber each other).
export const docs = defineDocs({
  dir: "src/features/docs/content/docs",
  docs: {
    schema: frontmatterSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export const design = defineDocs({
  dir: "src/features/design/content/docs",
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
