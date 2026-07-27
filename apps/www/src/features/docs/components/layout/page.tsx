"use client";
import { Link, usePathname } from "fumadocs-core/framework";
import type * as PageTree from "fumadocs-core/page-tree";
import type { TableOfContents, TOCItemType } from "fumadocs-core/toc";
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
        <article className="flex w-full max-w-[46rem] flex-1 flex-col px-5 py-12 md:mx-auto md:px-10 md:py-16">
          {props.children}
          <Footer />
        </article>
      </main>
      {toc.length > 0 && (
        <div className="sticky top-(--docs-header-height) h-[calc(100dvh-var(--docs-header-height))] w-[16rem] shrink-0 overflow-auto py-16 pr-6 max-xl:hidden">
          <p className="pb-3 pl-3 text-muted-foreground text-[13px] tracking-[-0.01em]">
            On this page
          </p>
          <div className="flex flex-col border-border border-l">
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
    <p
      {...props}
      className={cn(
        "mt-3 text-base text-muted-foreground leading-7 tracking-[-0.015em]",
        props.className,
      )}
    >
      {props.children}
    </p>
  );
}

export function DocsTitle(props: ComponentProps<"h1">) {
  return (
    <h1
      {...props}
      className={cn(
        "font-semibold text-[2rem] leading-[1.15] tracking-[-0.03em]",
        props.className,
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
        "-ml-px border-transparent border-l py-1.5 pr-2 text-[13px] leading-5 tracking-[-0.01em] transition-colors",
        isActive
          ? "border-foreground text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      href={item.url}
      style={{
        paddingLeft: 12 + Math.max(0, item.depth - 2) * 12,
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

  if (!previous && !next) {
    return null;
  }

  return (
    <div className="mt-20 grid grid-cols-1 border-border border-t sm:grid-cols-2">
      {previous ? (
        <FooterLink direction="previous" page={previous} />
      ) : (
        <div className="max-sm:hidden" />
      )}
      {next ? <FooterLink direction="next" page={next} /> : null}
    </div>
  );
}

/** Sibling-page link. A ruled pair rather than cards, so it reads as the page's own footer. */
function FooterLink({
  direction,
  page,
}: {
  direction: "previous" | "next";
  page: PageTree.Item;
}) {
  const isNext = direction === "next";
  const Chevron = isNext ? ChevronRightIcon : ChevronLeftIcon;

  return (
    <Link
      className={cn(
        "flex flex-col gap-1.5 border-border px-4 py-5 transition-colors hover:bg-accent/50",
        isNext ? "items-end text-right sm:border-l" : "items-start border-b sm:border-b-0",
      )}
      href={page.url}
    >
      <span className="flex items-center gap-1 text-[13px] text-muted-foreground tracking-[-0.01em]">
        {isNext ? null : <Chevron className="size-3.5" />}
        {isNext ? "Next" : "Previous"}
        {isNext ? <Chevron className="size-3.5" /> : null}
      </span>
      <span className="font-medium text-[15px] tracking-[-0.015em]">{page.name}</span>
    </Link>
  );
}
