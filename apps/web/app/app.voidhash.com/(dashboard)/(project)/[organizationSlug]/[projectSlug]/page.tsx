import { Next } from '@mcrovero/effect-nextjs';
import { Effect, Schema } from 'effect';
import { OverviewPage } from '@/features/overview/overview-page';
import { Page } from '@/lib/effect/runtimes/nextjs';

const _OverviewPage = Effect.fn('OverviewPage')(function* (props: {
  params: Promise<Record<string, string | undefined>>;
}) {
  const params = yield* Next.decodeParams(
    Schema.Struct({
      organizationSlug: Schema.String,
      projectSlug: Schema.String
    })
  )(props).pipe(
    Effect.catchTags({
      ParseError: () => Effect.succeed(null)
    })
  );

  if (!params) {
    return null;
  }

  return (
    <OverviewPage
      organizationSlug={params.organizationSlug}
      projectSlug={params.projectSlug}
    />
  );
});

export const OverviewPageExposed = Page.build(_OverviewPage);

export default OverviewPageExposed;
