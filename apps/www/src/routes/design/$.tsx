import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import browserCollections from "@generated/browser";
import type * as PageTree from "fumadocs-core/page-tree";
import {
  Accordion as DocsAccordion,
  Accordions as DocsAccordions,
} from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import {
  File as DocsFile,
  Files as DocsFiles,
  Folder as DocsFolder,
} from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab as DocsTab, Tabs as DocsTabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { type ComponentProps, Suspense, useMemo } from "react";

import { Preview } from "@/features/design/components/docs/preview";
import * as Registry from "@/features/design/components/docs/component-registry";
import { DocsLayout } from "@/features/design/components/layout/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "@/features/design/components/layout/page";
import { getSource } from "@/features/design/lib/source";

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

export const Route = createFileRoute("/design/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/").filter(Boolean) ?? [];
    if (slugs.length === 0) {
      throw notFound();
    }

    const result = (await serverLoader({ data: slugs })) as ServerPayload;
    if ("redirectTo" in result) {
      throw redirect({
        params: {
          _splat: result.redirectTo,
        },
        to: "/design/$",
      });
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

      throw notFound();
    }

    return {
      description: page.data.description,
      pageTree: source.getPageTree() as {},
      path: page.path,
      title: page.data.title,
    };
  });

const clientLoader = browserCollections.design.createClientLoader({
  component({ default: MDX, frontmatter }) {
    return (
      <DocsPage full={frontmatter.full === true}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX
            components={{
              ...defaultMdxComponents,
              ...Registry,
              Preview,
              Step,
              Steps,
              DocsFile,
              DocsFolder,
              DocsFiles,
              DocsTab,
              DocsTabs,
              TypeTable,
              DocsAccordion,
              DocsAccordions,
              a: DocsMdxLink,
              Callout: ({
                children,
                type,
                ...props
              }: {
                children: React.ReactNode;
                type?: "info" | "warn" | "error" | "success" | "warning";
                [key: string]: unknown;
              }) => (
                <Callout type={type} {...props}>
                  {children}
                </Callout>
              ),
              iframe: (props) => <iframe {...props} className="h-[500px] w-full" />,
            }}
          />
        </DocsBody>
      </DocsPage>
    );
  },
  id: "design",
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

function DocsMdxLink(props: ComponentProps<"a">) {
  const href = props.href;
  if (!href) {
    return <a {...props} />;
  }

  const normalizedHref =
    href.startsWith("/") && !href.startsWith("/design") && !href.startsWith("//")
      ? `/design${href}`
      : href;

  return <a {...props} href={normalizedHref} />;
}
