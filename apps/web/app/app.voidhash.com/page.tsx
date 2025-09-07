import { ErrorCard } from '@voidhash/ui';
import { Effect } from 'effect';
import { redirect } from 'next/navigation';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { UserService } from '@/lib/services/user.service';

export default async function Index() {
  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const userService = yield* UserService;
          const user = yield* userService.getUser();
          return { user };
        })
      );
    })
  );

  if (data.isErr()) {
    const err = data._unsafeUnwrapErr();

    if (err.code === 'NOT_FOUND' || err.code === 'UNAUTHORIZED') {
      return redirect('/login');
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

  const { user } = data.value;

  if (user.organizations.length === 0) {
    return redirect('/~/create-organization');
  }
  return redirect(`/${user.organizations[0]?.slug}`);
}
