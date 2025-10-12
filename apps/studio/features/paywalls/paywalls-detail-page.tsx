import {
  authenticateWithSession,
  PaywallService,
  ProductService,
  ProjectNotFoundError,
  ProjectService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { PaywallDetailPageEditor } from './paywall-detail-page-editor';

export const _PaywallsDetailPage = Effect.fn('PaywallsDetailPage')(function* ({
  organizationSlug,
  projectSlug,
  id
}: {
  organizationSlug: string;
  projectSlug: string;
  id: string;
}) {
  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      withEnvironmentFromCookie({ organizationSlug, projectSlug })(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          const paywallService = yield* PaywallService;
          const productService = yield* ProductService;
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

          const paywall = yield* paywallService.getPaywallById(id);

          const paywallProducts = yield* paywallService.getPaywallProducts(id);
          const products = yield* productService.getProducts(project.id);
          return { project, paywall, paywallProducts, products };
        })
      )
    )
  );

  if (Either.isLeft(data)) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the paywall'
        }}
      />
    );
  }

  const { paywall, paywallProducts, products } = data.right;

  return (
    <Page
      breadcrumbs={[
        {
          title: 'Paywalls',
          url: `/${organizationSlug}/${projectSlug}/paywalls`
        },
        {
          title: paywall.name,
          url: `/${organizationSlug}/${projectSlug}/paywalls/${id}`
        }
      ]}
    >
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <PaywallDetailPageEditor
          initialPaywallProducts={paywallProducts}
          paywall={paywall}
          products={products}
        />
      </div>
    </Page>
  );
});

export const PaywallsDetailPage = ServerComponent.build(_PaywallsDetailPage);
