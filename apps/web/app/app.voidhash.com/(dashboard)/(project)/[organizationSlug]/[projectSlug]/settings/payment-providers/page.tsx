import { Next } from '@mcrovero/effect-nextjs';
import { Effect, Schema } from 'effect';
import { PaymentProvidersPage } from '@/features/projects/settings/payment-providers/payment-providers-page';
import { Page } from '@/lib/effect/runtimes/nextjs';

const _PaymentProvidersPage = Effect.fn('PaymentProvidersPage')(
  function* (props: { params: Promise<Record<string, string | undefined>> }) {
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

    return <PaymentProvidersPage params={params} />;
  }
);

export const PaymentProvidersPageExposed = Page.build(_PaymentProvidersPage);

export default PaymentProvidersPageExposed;
