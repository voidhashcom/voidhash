'use client';
// import {
//   authenticateWithSession,
//   UnauthenticatedError,
//   UserService
// } from '@voidhash/core/services';

// import { ErrorCard } from '@voidhash/ui';
// import { Effect, Either } from 'effect';
// import { redirect } from 'next/navigation';
// import { headers } from '@/lib/effect/headers';
// import { Page } from '@/lib/nextjs-runtime';

// const _Index = Effect.fn('Index')(function* () {
//   const data = yield* Effect.either(
//     authenticateWithSession(yield* headers)(
//       Effect.gen(function* () {
//         const userService = yield* UserService;
//         const user = yield* userService.getUser(yield* headers);
//         return { user };
//       })
//     )
//   );

//   if (Either.isLeft(data)) {
//     const err = data.left;

//     if (err instanceof UnauthenticatedError) {
//       return redirect('/login');
//     }

//     return (
//       <ErrorCard
//         description="Please try again"
//         onRetry={() => {
//           window.location.reload();
//         }}
//         title="Something went wrong!"
//       />
//     );
//   }

//   const { user } = data.right;

//   if (user.organizations.length === 0) {
//     return redirect('/create-organization');
//   }
//   return redirect(`/${user.organizations[0]?.slug}`);
// });

// const Index = Page.build(_Index);

// export default Index;

import { Result } from '@effect-atom/atom-react';
import { ErrorCard } from '@voidhash/ui';
import { useUser } from 'atom/user';
import { useRouter } from 'next/navigation';

export default function Index() {
  const router = useRouter();
  const userFetch = useUser();
  return userFetch.pipe(
    Result.matchWithWaiting({
      onWaiting: () => null,
      onError: (e) => {
        if (
          e._tag === 'NotAuthenticatedError' ||
          e._tag === 'AuthenticationError'
        ) {
          setTimeout(() => {
            router.push('/login');
          }, 1);
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
      },
      onDefect: () => {
        return (
          <ErrorCard
            description="Please try again"
            onRetry={() => {
              window.location.reload();
            }}
            title="Something went wrong!"
          />
        );
      },
      onSuccess: ({ value: user }) => {
        if (user.organizations.length === 0) {
          setTimeout(() => {
            router.push('/create-organization');
          }, 1);
          return null;
        }
        setTimeout(() => {
          router.push(`/${user.organizations[0]?.slug}`);
        }, 1);
        return null;
      }
    })
  );
}
