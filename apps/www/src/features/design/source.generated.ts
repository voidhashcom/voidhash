/// <reference types="vite/client" />
import { fromConfig } from 'fumadocs-mdx/runtime/vite';
import type * as Config from './source.config';

export const create = fromConfig<typeof Config>();

export const docs = {
  doc: create.doc("docs", "./src/features/design/content/docs", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./src/features/design/content/docs",
    "query": {
      "collection": "docs"
    }
  })),
  meta: create.meta("docs", "./src/features/design/content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
    "import": "default",
    "base": "./src/features/design/content/docs",
    "query": {
      "collection": "docs"
    }
  }))
};