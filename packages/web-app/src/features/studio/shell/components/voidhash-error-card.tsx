"use client";

// import type { AnyVoidhashError } from '@voidhash/lib/constants';
import { ErrorCard } from "@voidhash/ui";

export function VoidhashErrorCard({
  error,
}: {
  error: { code: string; title?: string; message?: string };
}) {
  return (
    <ErrorCard
      className="h-screen"
      description={error.message ?? "Please try again later."}
      onRetry={() => {
        window.location.reload();
      }}
      title={error.title ?? "Something went wrong"}
    />
  );
}
