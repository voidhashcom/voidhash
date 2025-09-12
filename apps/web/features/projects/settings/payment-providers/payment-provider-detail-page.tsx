import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { PaymentProviderService } from '@/lib/services/payment-provider.service';
import { ProjectService } from '@/lib/services/project.service';
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
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
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
              new NotFoundError({
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
      );
    }).pipe(HandleCommonErrors)
  );

  if (Either.isLeft(data)) {
    const error = data.left;
    return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
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
