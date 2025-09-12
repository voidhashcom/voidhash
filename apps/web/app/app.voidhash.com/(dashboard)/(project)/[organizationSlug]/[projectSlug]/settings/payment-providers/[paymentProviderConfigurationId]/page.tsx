import { Next } from '@mcrovero/effect-nextjs';
import { Effect, Schema } from 'effect';
import { PaymentProviderDetailPage } from '@/features/projects/settings/payment-providers/payment-provider-detail-page';
import { Page } from '@/lib/effect/runtimes/nextjs';

const _PaymentProviderDetailPage = Effect.fn('PaymentProviderDetailPage')(
  function* (props: { params: Promise<Record<string, string | undefined>> }) {
    const params = yield* Next.decodeParams(
      Schema.Struct({
        paymentProviderConfigurationId: Schema.String,
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

    return <PaymentProviderDetailPage params={{ ...params }} />;
  }
);

export const PaymentProviderDetailPageExposed = Page.build(
  _PaymentProviderDetailPage
);

export default PaymentProviderDetailPageExposed;
