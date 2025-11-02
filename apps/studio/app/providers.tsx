'use client';
import { ProgressProvider } from '@bprogress/next/app';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '@voidhash/ui';
import type React from 'react';
import { queryClient } from '@/lib/effect-query';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
      <ProgressProvider
        color="#005EFF"
        height="2px"
        options={{ showSpinner: false }}
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
