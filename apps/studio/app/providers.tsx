'use client';
import { ProgressProvider } from '@bprogress/next/app';
import { Toaster } from '@voidhash/ui';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
      <ProgressProvider
        color="#005EFF"
        height="2px"
        options={{ showSpinner: false }}
      />
    </>
  );
}
