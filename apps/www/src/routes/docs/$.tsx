import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import browserCollections from "@generated/browser";
import { Effect } from "effect";
import type * as PageTree from "fumadocs-core/page-tree";
import { Suspense, useMemo } from "react";

import { DocsLayout } from "@/features/docs/components/layout/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "@/features/docs/components/layout/page";
import { docsMdxComponents } from "@/features/docs/lib/mdx-components";
import { getSource } from "@/features/docs/lib/source";

/**
 * Raises a TanStack Router control-flow signal (`notFound()`/`redirect()`).
 * The router detects these by catching the thrown descriptor; `runSync`
 * squashes the cause, so it still sees that exact object. The explicit `never`
 * return type is what lets TypeScript treat call sites as terminating.
 */
const raiseRouterSignal: (signal: unknown) => never = (signal) =>
  Effect.runSync(Effect.die(signal));

interface RedirectPayload {
  redirectTo: string;
}

interface PagePayload {
  description: string | undefined;
  pageTree: {};
  path: string;
  title: string;
}

type ServerPayload = PagePayload | RedirectPayload;

export const Route = createFileRoute("/docs/$")({
  component: Page,
  head: ({ loaderData }) => {
    // TanStack can't infer the sibling loader's return type while typing `head`,
    // so it widens loaderData to `undefined`; narrow it back to the page payload.
    const data = loaderData as unknown as PagePayload | undefined;
    if (!data || !("title" in data)) {
      return {};
    }

    return {
      meta: [
        { title: `${data.title} — Voidhash Docs` },
        ...(data.description ? [{ content: data.description, name: "description" }] : []),
      ],
    };
  },
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/").filter(Boolean) ?? [];
    if (slugs.length === 0) {
      raiseRouterSignal(notFound());
    }

    const result = (await serverLoader({ data: slugs })) as ServerPayload;
    if ("redirectTo" in result) {
      raiseRouterSignal(
        redirect({
          params: {
            _splat: result.redirectTo,
          },
          to: "/docs/$",
        }),
      );
    }

    return result;
  },
  notFoundComponent: () => <div>Page not found</div>,
});

const serverLoader = createServerFn({ method: "GET" })
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const source = await getSource();
    const page = source.getPage(slugs);
    if (!page) {
      const fallbackPage = source
        .getPages()
        .find(
          (candidate) =>
            candidate.slugs.length > slugs.length &&
            slugs.every((slug, index) => candidate.slugs[index] === slug),
        );

      if (fallbackPage) {
        return {
          redirectTo: fallbackPage.slugs.join("/"),
        };
      }

      raiseRouterSignal(notFound());
    }

    return {
      description: page.data.description,
      pageTree: source.getPageTree() as {},
      path: page.path,
      title: page.data.title,
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  id: "docs",
  component({ default: MDX, frontmatter, toc }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX components={docsMdxComponents} />
        </DocsBody>
      </DocsPage>
    );
  },
});

function PageContent({ path }: { path: string }) {
  const Content = useMemo(() => clientLoader.getComponent(path), [path]);
  return <Content />;
}

function Page() {
  const data = Route.useLoaderData() as PagePayload;

  return (
    <DocsLayout tree={data.pageTree as PageTree.Root}>
      <Suspense>
        <PageContent path={data.path} />
      </Suspense>
    </DocsLayout>
  );
}
