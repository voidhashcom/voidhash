import {
  authenticateWithSession,
  PaymentProviderService,
  ProjectNotFoundError,
  ProjectService
} from '@voidhash/core/services';
import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { PaymentProviderDetailConfiguration } from './payment-provider-detail-configuration';

export const _PaymentProviderDetailPage = Effect.fn(
  'PaymentProviderDetailPage'
)(function* ({
  params
}: {
  params: {
    paymentProviderConfigurationId: string;
    organizationSlug: string;
    projectSlug: string;
  };
}) {
  const { organizationSlug, projectSlug, paymentProviderConfigurationId } =
    params;

  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      Effect.gen(function* () {
        const projectService = yield* ProjectService;
        const paymentProviderService = yield* PaymentProviderService;
        const project =
          yield* projectService.getProjectBySlugAndOrganizationSlug({
            organizationSlug,
            projectSlug
          });
        if (!project) {
          return yield* Effect.fail(
            new ProjectNotFoundError({
              message: 'Project not found'
            })
          );
        }
        const paymentProviderConfiguration =
          yield* paymentProviderService.getPaymentProviderConfigurationById(
            paymentProviderConfigurationId
          );
        return { project, paymentProviderConfiguration };
      })
    )
  );

  if (Either.isLeft(data)) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the payment provider configuration'
        }}
      />
    );
  }

  const { project, paymentProviderConfiguration } = data.right;

  return (
    <Page
      breadcrumbs={[
        {
          title: 'Payment Providers',
          url: `/${organizationSlug}/${projectSlug}/settings/payment-providers`
        },
        {
          title: paymentProviderConfiguration.name,
          url: `/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`
        }
      ]}
      className="flex flex-1 flex-col p-0 pt-3 pb-0"
    >
      <PaymentProviderDetailConfiguration
        organizationSlug={organizationSlug}
        paymentProviderConfiguration={paymentProviderConfiguration}
        project={project}
        projectSlug={projectSlug}
      />
    </Page>
  );
});

export const PaymentProviderDetailPage = ServerComponent.build(
  _PaymentProviderDetailPage
);
