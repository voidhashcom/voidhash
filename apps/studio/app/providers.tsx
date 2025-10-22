'use client';
import { ProgressProvider } from '@bprogress/next/app';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@voidhash/ui';
import type React from 'react';
import { queryClient } from '@/lib/effect/tanstack-query';

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
    </QueryClientProvider>
  );
}
