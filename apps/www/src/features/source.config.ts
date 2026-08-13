import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from "../../../../packages/web-app/src/features/fumadocs-config.ts";
import {
  voidhashShikiDark,
  voidhashShikiLight,
} from "../../../../packages/web-app/src/features/docs/lib/shiki-theme.ts";

// Each entrypoint owns one Fumadocs config and generated output directory.
//
// The community app compiles the docs collection even though it does not serve
// a docs site — the studio renders guide pages in-app through `WhereToFindGuide`
// off this same generated collection. The published docs site is hosted-only.
export const docs = defineDocs({
  dir: "../../packages/web-app/src/features/docs/content/docs",
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
