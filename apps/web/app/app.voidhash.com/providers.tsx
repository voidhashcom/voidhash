'use client';
import { ProgressProvider } from '@bprogress/next/app';
import { Toaster } from '@voidhash/ui';
import { TRPCReactProvider } from '@/features/trpc/react';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      {children}
      <Toaster />
      <ProgressProvider
        color="#005EFF"
        height="2px"
        options={{ showSpinner: false }}
      />
    </TRPCReactProvider>
  );
}
