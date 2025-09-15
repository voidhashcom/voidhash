import { ErrorCard } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { redirect } from 'next/navigation';
import { NotFoundError, UnauthorizedError } from '@/lib/effect/errors';
import { Page } from '@/lib/effect/runtimes/nextjs';
import { authenticateWithSession } from '@/lib/services/auth.service';
import { UserService } from '@/lib/services/user.service';

const _Index = Effect.fn('Index')(function* () {
  const data = yield* Effect.either(
    authenticateWithSession(
      Effect.gen(function* () {
        const userService = yield* UserService;
        const user = yield* userService.getUser();
        return { user };
      })
    )
  );

  if (Either.isLeft(data)) {
    const err = data.left;

    if (err instanceof NotFoundError || err instanceof UnauthorizedError) {
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

  const { user } = data.right;

  if (user.organizations.length === 0) {
    return redirect('/~/create-organization');
  }
  return redirect(`/${user.organizations[0]?.slug}`);
});

export const Index = Page.build(_Index);

export default Index;
