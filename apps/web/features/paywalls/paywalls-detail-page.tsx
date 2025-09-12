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
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
import { PaywallService } from '@/lib/services/paywall.service';
import { ProductService } from '@/lib/services/product.service';
import { ProjectService } from '@/lib/services/project.service';
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
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
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
              new NotFoundError({
                message: 'Project not found'
              })
            );
          }
          const environmentService = yield* EnvironmentService;
          const environment =
            yield* environmentService.getEnvironmentFromCookie({
              organizationSlug,
              projectSlug
            });
          return yield* Environment.provide(environment)(
            Effect.gen(function* () {
              const paywall = yield* paywallService.getPaywallById(id).pipe(
                Effect.catchTags({
                  PaywallNotFoundError: (error) =>
                    Effect.fail(new NotFoundError({ message: error.message }))
                })
              );

              const paywallProducts = yield* paywallService
                .getPaywallProducts(id)
                .pipe(
                  Effect.catchTags({
                    PaywallNotFoundError: (error) =>
                      Effect.fail(new NotFoundError({ message: error.message }))
                  })
                );
              const products = yield* productService.getProducts(project.id);
              return { project, paywall, paywallProducts, products };
            })
          );
        })
      );
    }).pipe(HandleCommonErrors)
  );

  if (Either.isLeft(data)) {
    const error = data.left;
    return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
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
