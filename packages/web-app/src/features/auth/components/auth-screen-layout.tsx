import { Link } from "@tanstack/react-router";
import { Logo } from "@voidhash/ui";
import type { ReactNode } from "react";

import { AuthLenticularBackground } from "./auth-lenticular-background";

/** Shared page chrome for the auth screens: background, brand mark, centered column. */
export function AuthScreenLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-svh overflow-hidden bg-background lg:grid-cols-12">
      <AuthLenticularBackground className="absolute inset-0" />
      <div className="relative z-10 col-span-8 flex flex-col gap-4 p-6 md:p-10 bg-linear-to-r from-background to-transparent">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link className="flex gap-2 font-medium" to="/">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
