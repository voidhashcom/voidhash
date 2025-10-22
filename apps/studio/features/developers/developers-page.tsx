'use client';
import { useCurrentUser } from 'hooks/tanstack-query';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';

export const DevelopersPage = () => {
  const { status: currentUserStatus } = useCurrentUser();
  if (currentUserStatus === 'pending') {
    return <div>Loading...</div>;
  }
  if (currentUserStatus === 'error') {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the developers'
        }}
      />
    );
  }

  return (
    <Page>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">Developers</h1>
      </div>
    </Page>
  );
};
