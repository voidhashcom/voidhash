'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@voidhash/ui';
import { useParams } from 'next/navigation';
import { useAuth } from 'src/components/auth-context';
import { Page } from 'src/features/shell';
import { VoidhashErrorCard } from 'src/features/shell/components/voidhash-error-card';
import { listProductsOptions } from 'src/lib/tanstack-query/products';
import { CurrentUser } from 'src/lib/utils/current-user';
import { CreateProductModalButton } from './create-product-modal-button';
import { ProductRecord } from './product-record';
import { ProductRecordConfigurationStateIndicator } from './product-record-configuration-state-indicator';
import { ProductsPageEmptyState } from './products-page-empty-state';
import { ProductsPageSkeleton } from './products-page-skeleton';

export const ProductsPage = () => {
  const { organizationSlug, projectSlug } = useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );
  const { data: products, status: productsStatus } = useQuery({
    ...listProductsOptions({ projectId: project?.id ?? '' }),
    enabled: !!project?.id
  });

  if (productsStatus === 'pending') {
    return <ProductsPageSkeleton />;
  }

  if (productsStatus === 'error' || !project) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the products'
        }}
      />
    );
  }

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
                  organizationSlug={organizationSlug as string}
                  product={product}
                  projectSlug={projectSlug as string}
                />
              ))}
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
};
