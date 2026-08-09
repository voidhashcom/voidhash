/**
 * Ambient types for the fumadocs-mdx generated runtime bundles.
 *
 * The real modules live in `.source/{server,browser}.ts` (emitted by the
 * `fumadocs-mdx` vite plugin / CLI and resolved at runtime via `resolve.alias`
 * in `vite.config.ts`). Those generated files carry `// @ts-nocheck` and rely on
 * Vite-only constructs (`import.meta.glob`, top-level `await`), so we describe
 * their public shape here instead of having `tsc` type-check the artifacts.
 */

declare module "@generated/server" {
  import type { Source } from "fumadocs-core/source";

  interface ServerCollection {
    /** Builds a fumadocs `Source` consumable by `loader()`. */
    toFumadocsSource(options?: { baseDir?: string }): Source<{
      pageData: Record<string, unknown>;
      metaData: Record<string, unknown>;
    }>;
  }

  export const docs: ServerCollection;
  export const design: ServerCollection;
}

declare module "@generated/browser" {
  import type { ComponentType, ReactNode } from "react";
  import type { TableOfContents } from "fumadocs-core/toc";

  interface MDXModule {
    default: ComponentType<{ components?: Record<string, unknown> }>;
    frontmatter: { title: string; description?: string; [key: string]: unknown };
    toc: TableOfContents;
  }

  interface ClientLoader {
    preload(path: string): Promise<MDXModule>;
    getComponent(path: string): ComponentType;
    useContent(path: string, props?: Record<string, unknown>): ReactNode;
  }

  interface BrowserCollection {
    /** The raw `import.meta.glob` map of `slug -> () => Promise<MDXModule>`. */
    raw: Record<string, () => Promise<MDXModule>>;
    createClientLoader(options: {
      id?: string;
      component: (doc: MDXModule, props?: Record<string, unknown>) => ReactNode;
    }): ClientLoader;
  }

  const collections: { docs: BrowserCollection; design: BrowserCollection };
  export default collections;
}
