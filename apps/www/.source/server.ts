// @ts-nocheck
/// <reference types="vite/client" />
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../src/features/source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docs("docs", "src/features/docs/content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../src/features/docs/content/docs",
  "query": {
    "collection": "docs"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../src/features/docs/content/docs",
  "query": {
    "collection": "docs"
  },
  "eager": true
}));

export const design = await create.docs("design", "src/features/design/content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../src/features/design/content/docs",
  "query": {
    "collection": "design"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../src/features/design/content/docs",
  "query": {
    "collection": "design"
  },
  "eager": true
}));