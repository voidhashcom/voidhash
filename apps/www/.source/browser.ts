// @ts-nocheck
/// <reference types="vite/client" />
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../src/features/source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../src/features/docs/content/docs",
    "query": {
      "collection": "docs"
    },
    "eager": false
  })),
  design: create.doc("design", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../src/features/design/content/docs",
    "query": {
      "collection": "design"
    },
    "eager": false
  })),
};
export default browserCollections;