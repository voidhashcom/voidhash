'use client';

import { ErrorCard } from '@voidhash/ui';
import { Cause } from 'effect';
import { useCurrentUser } from 'hooks/tanstack-query/users';
import { useRouter } from 'next/navigation';

function nextRenderRedirect(
  router: ReturnType<typeof useRouter>,
  path: string
) {
  setTimeout(() => {
    router.push(path);
  }, 1);
}

export default function Index() {
  const router = useRouter();
  const {
    status,
    data: currentUser,
    error: currentUserError
  } = useCurrentUser();
  if (status === 'pending') {
    return null;
  }

  if (status === 'error') {
    const error = Cause.isFailType(currentUserError.cause)
      ? currentUserError.cause.error
      : null;
    if (
      error?._tag === 'NotAuthenticatedError' ||
      error?._tag === 'AuthenticationError'
    ) {
      nextRenderRedirect(router, '/login');
      return null;
    }
    return (
      <ErrorCard
        description="Please try again"
        onRetry={() => {
          window.location.reload();
        }}
        title="Something went wrong!"
      />
    );
  }

  if (currentUser) {
    if (currentUser.organizations.length === 0) {
      nextRenderRedirect(router, '/create-organization');
      return null;
    }
    nextRenderRedirect(router, `/${currentUser.organizations[0]?.slug}`);
    return null;
  }

  return null;
}
