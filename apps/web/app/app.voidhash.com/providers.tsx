'use client';
import { Toaster } from '@voidhash/ui';
import { Next13ProgressBar } from 'next13-progressbar';
import { TRPCReactProvider } from '@/features/trpc/react';
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      {children}
      <Toaster />
      <Next13ProgressBar
        color="#005EFF"
        height="2px"
        options={{ showSpinner: false }}
        showOnShallow
      />
    </TRPCReactProvider>
  );
}
