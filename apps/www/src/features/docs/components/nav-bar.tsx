"use client";

import { Button, CommandShortcut, Logo, cn, useSidebar } from "@voidhash/ui";
import { Link as FrameworkLink, usePathname } from "fumadocs-core/framework";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { MenuIcon, SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { DOCS_TABS, activeTabForPathname } from "../lib/tabs";
import { DocsThemeToggle } from "./theme-toggle";

function SearchToggle(props: ComponentProps<"button">) {
  const { enabled, setOpenSearch } = useSearchContext();
  if (!enabled) {
    return;
  }

  return (
    <button
      {...props}
      className={cn("flex items-center gap-2 bg-transparent text-sm md:bg-muted ", props.className)}
      onClick={() => setOpenSearch(true)}
    >
      <SearchIcon className="size-4 cursor-pointer text-muted-foreground " />
      <span className="mr-4 hidden flex-1 text-left text-muted-foreground md:block">
        Search documentation...
      </span>
      <CommandShortcut className="hidden md:block">⌘K</CommandShortcut>
    </button>
  );
}

/** The Documentation / Guides / API Reference tabs shown in the docs header. */
function DocsTabs() {
  const pathname = usePathname();
  const active = activeTabForPathname(pathname);

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {DOCS_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active.id;
        return (
          <FrameworkLink
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            href={tab.home}
            key={tab.id}
          >
            <Icon className="size-4" />
            <span>{tab.label}</span>
          </FrameworkLink>
        );
      })}
    </nav>
  );
}

export function NavBar() {
  return (
    <div className="fixed z-50 flex h-[var(--header-height)] w-full items-center justify-between gap-4 bg-sidebar px-4 transition-all duration-75 md:left-[var(--sidebar-width)] md:w-[calc(100vw-var(--sidebar-width))]">
      <div className="flex items-center gap-1">
        <a className="flex items-center gap-2 md:hidden" href="https://voidhash.com">
          <Logo className="h-5" color="mono" variant="default" />
          <span className="rounded-md bg-muted p-1 px-2 font-semibold text-foreground text-xs uppercase">
            Docs
          </span>
        </a>
        <DocsTabs />
      </div>

      <div className="flex items-center gap-2">
        <SearchToggle className="hidden cursor-pointer rounded-lg bg-muted p-1.5 px-3 hover:bg-accent md:flex" />
        <SearchToggle className="md:hidden" />
        <DocsThemeToggle />
        <SidebarToggle />
        <a className="hidden md:block" href="https://app.voidhash.com">
          <Button size="sm" variant="outline">
            Dashboard
          </Button>
        </a>
      </div>
    </div>
  );
}

function SidebarToggle() {
  const { openMobile, setOpenMobile } = useSidebar();
  const handleToggle = () => {
    setOpenMobile(!openMobile);
  };
  return (
    <Button className={cn("md:hidden")} onClick={handleToggle} variant="ghost">
      <MenuIcon className="size-4" />
    </Button>
  );
}
