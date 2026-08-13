"use client";
import { cn } from "@voidhash/ui";
import type { ComponentProps } from "react";

/**
 * The prose wrapper for rendered documentation MDX. It lives here rather than
 * with the docs site (which is hosted-only) because the studio renders guide
 * content in-app through `GuideBody`; the hosted site re-exports it so both
 * surfaces share one prose treatment.
 */
export function DocsBody(props: ComponentProps<"div">) {
  return (
    <div {...props} className={cn("prose ", props.className)}>
      {props.children}
    </div>
  );
}
