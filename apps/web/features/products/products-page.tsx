import { Card } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { authenticateWithSession } from '@/lib/services/auth.service';
import { withEnvironmentFromCookie } from '@/lib/services/environment.service';
import { ProductService } from '@/lib/services/product.service';
import { ProjectService } from '@/lib/services/project.service';
import { CreateProductModalButton } from './create-product-modal-button';
import { ProductRecord } from './product-record';
import { ProductRecordConfigurationStateIndicator } from './product-record-configuration-state-indicator';
import { ProductsPageEmptyState } from './products-page-empty-state';

export const _ProductsPage = Effect.fn('ProductsPage')(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug;
}) {
  const data = yield* Effect.either(
    Effect.gen(function* () {
      return yield* authenticateWithSession(
        withEnvironmentFromCookie({ organizationSlug, projectSlug })(
          Effect.gen(function* () {
            const projectService = yield* ProjectService;
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
            const products = yield* productService.getProducts(project.id);
            return { project, products };
          })
        )
      );
    }).pipe(HandleCommonErrors)
  );

  if (Either.isLeft(data)) {
    const error = data.left;
    return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
  }

  const { project, products } = data.right;

  return (
    <Page>
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-row items-center justify-between">
          <h1 className="font-normal text-3xl tracking-right">Products</h1>
          {products.length > 0 && (
            <CreateProductModalButton projectId={project.id} />
          )}
        </div>
        <p className="mt-3 text-muted-foreground">
          List of products available to purchase.
        </p>

        <div className="mt-8">
          {products.length === 0 ? (
            <ProductsPageEmptyState projectId={project.id} />
          ) : (
            <Card className="grid gap-0 divide-y p-0">
              {products.map((product) => (
                <ProductRecord
                  configurationStateIndicator={
                    <ProductRecordConfigurationStateIndicator
                      productId={product.id}
                      projectId={project.id}
                    />
                  }
                  key={product.id}
                  organizationSlug={organizationSlug}
                  product={product}
                  projectSlug={projectSlug}
                />
              ))}
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
});

export const ProductsPage = ServerComponent.build(_ProductsPage);
