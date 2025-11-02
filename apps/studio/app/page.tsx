'use client';

import { ErrorCard } from '@voidhash/ui';
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
    return currentUserError.match({
      NotAuthenticatedError: () => {
        nextRenderRedirect(router, '/login');
        return null;
      },
      AuthenticationError: () => {
        nextRenderRedirect(router, '/login');
        return null;
      },
      OrElse: () => {
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
    });
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
