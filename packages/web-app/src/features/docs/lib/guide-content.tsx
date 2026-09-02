"use client";

import browserCollections from "@generated/browser";
import { lazy, Suspense, useMemo } from "react";

const docMap = browserCollections.docs.raw;

import { DocsBody } from "@/features/docs/components/docs-body";
import { docsMdxComponents } from "@/features/docs/lib/mdx-components";

/** Strips the generated doc-map decorations from a key: `./a/b.mdx` -> `a/b`. */
const normalizeKey = (key: string): string => key.replace(/^\.\//, "").replace(/\.mdx?$/, "");

const guideKeyBySlug = new Map<string, string>(
  Object.keys(docMap).map((key) => [normalizeKey(key), key]),
);

/**
 * Resolves a guide slug — the same path used for its public page at
 * `/docs/<slug>` — to the exact key in the generated doc map, or `undefined`
 * when no guide exists for that slug.
 */
export const resolveGuideKey = (slug: string): string | undefined => {
  const normalized = slug
    .replace(/^\/+/, "")
    .replace(/^docs\//, "")
    .replace(/\/+$/, "");

  return guideKeyBySlug.get(normalized);
};

/** Returns true when a guide exists for the given slug. */
export const hasGuide = (slug: string): boolean => resolveGuideKey(slug) !== undefined;

/**
 * Lazily renders a documentation guide's compiled MDX body using the shared
 * docs component map ({@link docsMdxComponents}), so a guide looks identical
 * here and on the public docs site. The MDX chunk is only fetched once this
 * component mounts.
 */
export function GuideBody({ slug }: { slug: string }) {
  const key = resolveGuideKey(slug);

  const Content = useMemo(() => {
    if (!key) {
      return undefined;
    }

    const loader = docMap[key];
    return loader ? lazy(loader) : undefined;
  }, [key]);

  if (!Content) {
    console.warn(`[where-to-find] No documentation guide found for "${slug}"`);
    return <p className="text-muted-foreground text-sm">This guide is not available yet.</p>;
  }

  return (
    <Suspense fallback={<GuideBodySkeleton />}>
      <DocsBody>
        <Content components={docsMdxComponents} />
      </DocsBody>
    </Suspense>
  );
}

function GuideBodySkeleton() {
  return (
    <div aria-hidden className="flex animate-pulse flex-col gap-3">
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-5/6 rounded bg-muted" />
      <div className="mt-2 h-40 w-full rounded bg-muted" />
    </div>
  );
}
