"use client";

import { Button, CommandShortcut, Logo, cn } from "@voidhash/ui";
import { Link as FrameworkLink, usePathname } from "fumadocs-core/framework";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { MenuIcon, SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { STUDIO_PATH } from "@/lib/paths";

import { DOCS_TABS, activeTabForPathname } from "../lib/tabs";
import { DocsThemeToggle } from "./theme-toggle";

function SearchToggle({ className, ...props }: ComponentProps<"button">) {
  const { enabled, setOpenSearch } = useSearchContext();
  if (!enabled) {
    return;
  }

  return (
    <button
      {...props}
      className={cn(
        "flex cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground md:rounded-lg md:border md:border-border md:px-2.5 md:py-1.5 md:hover:bg-accent",
        className,
      )}
      onClick={() => setOpenSearch(true)}
      type="button"
    >
      <SearchIcon className="size-4" />
      <span className="hidden flex-1 text-left tracking-[-0.01em] md:block">Search docs</span>
      <CommandShortcut className="hidden md:block">⌘K</CommandShortcut>
    </button>
  );
}

/**
 * The Documentation / Guides / API Reference tabs. They run the full height of
 * the header so the active tab's underline sits on the header's own hairline.
 */
function DocsTabs() {
  const pathname = usePathname();
  const active = activeTabForPathname(pathname);

  return (
    <nav className="hidden h-full items-center gap-6 md:flex">
      {DOCS_TABS.map((tab) => {
        const isActive = tab.id === active.id;
        return (
          <FrameworkLink
            className={cn(
              "-mb-px flex h-full items-center border-transparent border-b text-sm tracking-[-0.01em] transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            href={tab.home}
            key={tab.id}
          >
            {tab.label}
          </FrameworkLink>
        );
      })}
    </nav>
  );
}

export function NavBar({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-(--docs-header-height) items-center border-border border-b bg-background/85 backdrop-blur-md">
      <div className="flex h-full w-(--docs-sidebar-width) shrink-0 items-center gap-2.5 border-border px-3 lg:border-r">
        <button
          aria-label="Open navigation"
          className="-ml-1 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          onClick={onOpenNav}
          type="button"
        >
          <MenuIcon className="size-4" />
        </button>
        <a className="flex items-center gap-2.5" href="/">
          <Logo className="h-4 w-auto" color="mono" variant="default" />
          <span className="text-muted-foreground text-sm tracking-[-0.01em]">Docs</span>
        </a>
      </div>

      <div className="flex h-full min-w-0 flex-1 items-center justify-between gap-4 px-4 md:px-6">
        <DocsTabs />
        <div className="ml-auto flex items-center gap-3">
          <SearchToggle className="md:min-w-56" />
          <DocsThemeToggle />
          <Button asChild className="hidden md:inline-flex" size="sm" variant="outline">
            <a href={STUDIO_PATH}>Dashboard</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
