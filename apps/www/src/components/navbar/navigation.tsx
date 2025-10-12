'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
// import { Button } from '../button';
import { Logo } from '../logo';

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div>
      <nav
        className={cn(
          'fixed top-0 right-0 left-0 z-50 flex h-16 w-full items-center justify-start bg-background backdrop-blur-sm',
          isScrolled && 'border-border border-b'
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-4">
          <Link href="https://voidhash.com">
            <Logo className="h-6" />
          </Link>
          <div className="flex-1" />
          {/* <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              Log In
            </Button>
            <Button size="sm">
              <span>Get Started</span>
              <ChevronRight className="size-4 opacity-50" />
            </Button>
          </div> */}
        </div>
      </nav>
      <div className="h-16" />
    </div>
  );
}
