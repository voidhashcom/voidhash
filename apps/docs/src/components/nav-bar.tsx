'use client';
import { Button, CommandShortcut, cn, Logo, ThemeToggle } from '@voidhash/ui';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import type { ComponentProps } from 'react';

function SearchToggle(props: ComponentProps<'button'>) {
  const { enabled, setOpenSearch } = useSearchContext();
  if (!enabled) {
    return;
  }

  return (
    <button
      {...props}
      className={cn('flex items-center gap-2 text-sm ', props.className)}
      onClick={() => setOpenSearch(true)}
    >
      <SearchIcon className="size-4 cursor-pointer text-muted-foreground " />
      <span className="mr-4 flex-1 text-left text-muted-foreground">
        Search documentation...
      </span>
      <CommandShortcut>⌘K</CommandShortcut>
    </button>
  );
}

export function NavBar() {
  const { theme = 'system', setTheme } = useTheme();
  return (
    <div className="fixed z-10 flex h-[var(--header-height)] w-full flex-row items-center justify-between border-border border-b bg-background transition-all duration-75">
      <div className="flex flex-1 items-center justify-between px-4 py-2">
        <div className="flex flex-1 items-center gap-7">
          <Link
            className="flex items-center gap-3"
            href={'https://voidhash.com'}
          >
            <Logo className="ml-2 h-6" color="mono" variant="default" />
            <span className="rounded-md border-border bg-muted p-1 px-2 font-semibold text-foreground text-xs uppercase">
              Docs
            </span>
          </Link>
          <SearchToggle className="ml-8 cursor-pointer rounded-lg bg-muted p-2 px-3 hover:bg-accent" />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle setTheme={setTheme} theme={theme} />
          <Button variant="outline">Dashboard</Button>
        </div>
      </div>
    </div>
  );
}
