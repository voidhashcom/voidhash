import { Link } from "@tanstack/react-router";
import { Logo } from "@voidhash/ui";
import { type ReactNode, useEffect, useState } from "react";

import { AuthLenticularBackground } from "./auth-lenticular-background";

/** Frames sign-in and sign-up with the brand mark above the form and a desktop shader panel. */
export function AuthScreenLayout({ children }: { children: ReactNode }) {
  const [showShader, setShowShader] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setShowShader(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <main className="dark relative flex min-h-svh flex-col bg-background font-sans text-foreground [--auth-inset:16px] sm:[--auth-inset:32px] lg:[--auth-inset:38px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-(--auth-inset) inset-y-0 border-x border-border"
      />
      <div aria-hidden className="h-(--auth-inset) shrink-0" />
      <div className="relative flex flex-1 border-y border-border">
        <div className="mx-(--auth-inset) grid min-w-0 flex-1 border-x border-transparent lg:grid-cols-2">
          <div className="flex min-w-0 items-center justify-center px-6 py-10 sm:p-10">
            <div className="w-full max-w-sm">
              <Link
                aria-label="Voidhash home"
                className="mb-8 flex w-fit rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                to="/"
              >
                <Logo
                  className="h-[17px] w-[119px]"
                  preserveAspectRatio="none"
                  viewBox="0 8.5 409.159 61"
                />
              </Link>
              {children}
            </div>
          </div>
          <div
            aria-hidden
            className="relative hidden overflow-hidden border-l border-border [container-type:size] lg:block"
          >
            {/* Preserve the original shader composition while cropping it to the panel. */}
            {showShader && (
              <AuthLenticularBackground className="absolute left-3/5 top-1/2 h-[max(100cqh,62.5cqw)] w-[max(100cqw,160cqh)] -translate-x-3/5 -translate-y-1/2" />
            )}
          </div>
        </div>
      </div>
      <div aria-hidden className="h-(--auth-inset) shrink-0" />
    </main>
  );
}
