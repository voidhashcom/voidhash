"use client";

import { cn } from "@/features/design/lib/cn";
import type { ReactNode } from "react";

interface PreviewProps {
  children: ReactNode;
  className?: string;
  centered?: boolean;
}

export function Preview({ children, className, centered = true }: PreviewProps) {
  return (
    <div
      className={cn(
        "not-prose rounded-lg border bg-background p-6",
        centered && "flex items-center justify-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
