// @ts-nocheck
/// <reference types="vite/client" />
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../src/features/source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docs("docs", "../../packages/web-app/src/features/docs/content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../../../packages/web-app/src/features/docs/content/docs",
  "query": {
    "collection": "docs"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../../../packages/web-app/src/features/docs/content/docs",
  "query": {
    "collection": "docs"
  },
  "eager": true
}));