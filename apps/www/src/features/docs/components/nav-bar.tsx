"use client";

import { Button, CommandShortcut, Logo, cn, useSidebar } from "@voidhash/ui";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { MenuIcon, SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";

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

export function NavBar() {
  return (
    <div className="fixed z-10 flex h-[var(--header-height)] w-full flex-row items-center justify-between border-border border-b bg-background transition-all duration-75">
      <div className="flex flex-1 items-center justify-between px-4 py-2">
        <div className="mr-7 flex items-center">
          <a className="flex items-center gap-3" href="https://voidhash.com">
            <Logo className="ml-2 h-6" color="mono" variant="default" />
            <span className="rounded-md border-border bg-muted p-1 px-2 font-semibold text-foreground text-xs uppercase">
              Docs
            </span>
          </a>
        </div>
        <div className="flex items-center gap-2 md:flex-1">
          <div className="md:flex-1">
            <SearchToggle className="ml-8 cursor-pointer rounded-lg bg-muted p-2 px-3 hover:bg-accent" />
          </div>
          <DocsThemeToggle />
          <SidebarToggle />
          <a className="hidden md:block" href="https://app.voidhash.com">
            <Button variant="outline">Dashboard</Button>
          </a>
        </div>
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
