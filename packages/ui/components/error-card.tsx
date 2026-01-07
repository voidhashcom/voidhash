"use client";

import { cn } from "../lib/utils";
import { Logo } from "./logo";
import { Button } from "./ui/button";

export function ErrorCard({
  title,
  description,
  onRetry,
  className,
}: {
  title: string;
  description: string;
  className?: string;
  onRetry: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-6",
        className
      )}
    >
      <a href="/">
        <Logo />
      </a>
      <div className="flex flex-col items-center justify-center gap-3">
        <h1 className="font-bold text-2xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}
