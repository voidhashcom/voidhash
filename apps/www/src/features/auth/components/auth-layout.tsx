import { Link } from "@tanstack/react-router";
import { Logo } from "@voidhash/ui";
import type { ReactNode } from "react";

import { AuthLenticularBackground } from "./auth-lenticular-background";

export type AuthLayoutProps = {
  children: ReactNode;
};

/**
 * Shared shell for the auth surfaces. Renders the lenticular Voidhash gradient
 * behind a backdrop-blurred form column with the logo (linking home), matching
 * the sign-in / sign-up layout. Page content is centred in a `max-w-sm` column.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
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

export type AuthHeaderProps = {
  title: string;
  description?: ReactNode;
};

/** Left-aligned heading block used at the top of each auth page's content column. */
export function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <div className="flex flex-col items-start gap-2 text-left">
      <h1 className="text-3xl">{title}</h1>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
    </div>
  );
}
