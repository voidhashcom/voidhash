"use client";
import { Card, CardContent, CardDescription, CardTitle } from "@voidhash/ui";
import { Link, usePathname } from "fumadocs-core/framework";
import type {
  PageTree,
  TableOfContents,
  TOCItemType,
} from "fumadocs-core/server";
import { AnchorProvider, useActiveAnchors } from "fumadocs-core/toc";
import { useTreeContext } from "fumadocs-ui/contexts/tree";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useMemo } from "react";

import { cn } from "../../lib/cn";

export interface DocsPageProps {
  toc?: TableOfContents;

  children: ReactNode;
}

export function DocsPage({ toc = [], ...props }: DocsPageProps) {
  return (
    <AnchorProvider toc={toc}>
      <main className="flex w-full min-w-0 flex-col">
        <article className="flex w-full max-w-[860px] flex-1 flex-col gap-6 px-4 py-8 md:mx-auto md:px-6">
          {props.children}
          <Footer />
        </article>
      </main>
      {toc.length > 0 && (
        <div className="sticky top-(--header-height) h-[calc(100dvh-var(--header-height))] w-[286px] shrink-0 overflow-auto p-4 max-xl:hidden">
          <p className="mb-2 text-fd-muted-foreground text-sm">On this page</p>
          <div className="flex flex-col">
            {toc.map((item) => (
              <TocItem item={item} key={item.url} />
            ))}
          </div>
        </div>
      )}
    </AnchorProvider>
  );
}

export function DocsBody(props: ComponentProps<"div">) {
  return (
    <div {...props} className={cn("prose ", props.className)}>
      {props.children}
    </div>
  );
}

export function DocsDescription(props: ComponentProps<"p">) {
  // don't render if no description provided
  if (props.children === undefined) {
    return null;
  }

  return (
    <p {...props} className={cn("mt-1 text-muted-foreground", props.className)}>
      {props.children}
    </p>
  );
}

export function DocsTitle(props: ComponentProps<"h1">) {
  return (
    <h1
      {...props}
      className={cn(
        "mt-8 font-semibold text-3xl tracking-right",
        props.className
      )}
    >
      {props.children}
    </h1>
  );
}

function TocItem({ item }: { item: TOCItemType }) {
  const isActive = useActiveAnchors().includes(item.url.slice(1));

  return (
    <a
      className={cn(
        "py-1 text-fd-foreground/80 text-sm",
        isActive && "text-fd-primary"
      )}
      href={item.url}
      style={{
        paddingLeft: Math.max(0, item.depth - 2) * 16,
      }}
    >
      {item.title}
    </a>
  );
}

function Footer() {
  const { root } = useTreeContext();
  const pathname = usePathname();
  const flatten = useMemo(() => {
    const result: PageTree.Item[] = [];

    function scan(items: PageTree.Node[]) {
      for (const item of items) {
        if (item.type === "page") {
          result.push(item);
        } else if (item.type === "folder") {
          if (item.index) {
            result.push(item.index);
          }
          scan(item.children);
        }
      }
    }

    scan(root.children);
    return result;
  }, [root]);

  const { previous, next } = useMemo(() => {
    const idx = flatten.findIndex((item) => item.url === pathname);

    if (idx === -1) {
      return {};
    }
    return {
      next: flatten[idx + 1],
      previous: flatten[idx - 1],
    };
  }, [flatten, pathname]);

  return (
    <div className="flex flex-row items-center justify-between gap-8">
      {previous ? (
        <Link className="flex-1" href={previous.url}>
          <Card className="rounded-none hover:bg-card">
            <CardContent>
              <CardDescription className="mt-1 flex items-center">
                <ChevronLeftIcon className="-ml-1 mr-1 size-4" />{" "}
                <span>Previous Page</span>
              </CardDescription>
              <CardTitle className="mt-2 font-normal text-md">
                {previous.name}
              </CardTitle>
            </CardContent>
          </Card>
        </Link>
      ) : null}
      {next ? (
        <Link className="flex-1" href={next.url}>
          <Card className="rounded-none hover:bg-card">
            <CardContent className="flex w-full flex-col items-end">
              <CardDescription className="mt-1 flex items-center">
                <span>Next Page</span>
                <ChevronRightIcon className="-mr-1 ml-1 size-4" />{" "}
              </CardDescription>
              <CardTitle className="mt-2 font-normal text-md">
                {next.name}
              </CardTitle>
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </div>
  );
}
