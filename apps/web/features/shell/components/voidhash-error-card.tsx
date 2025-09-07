'use client';

import type { AnyVoidhashError } from '@voidhash/lib/constants';
import { ErrorCard } from '@voidhash/ui';
import type { NextjsErrorResponse } from '@/lib/effect/runtimes/nextjs';

export function VoidhashErrorCard({
  error
}: {
  error: AnyVoidhashError | NextjsErrorResponse;
}) {
  // TODO: Improve this a lot
  return (
    <ErrorCard
      className="h-screen"
      description={
        error.code !== 'INTERNAL_SERVER_ERROR'
          ? error.message
          : 'Please try again later'
      }
      onRetry={() => {
        window.location.reload();
      }}
      title="Something went wrong"
    />
  );
}
