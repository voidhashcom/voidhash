import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@voidhash/ui";
import { useAuth } from "src/components/auth-context";

import { CreateProductModalButton } from "@/features/products/create-product-modal-button";
import { ProductRecord } from "@/features/products/product-record";
import { ProductRecordConfigurationStateIndicator } from "@/features/products/product-record-configuration-state-indicator";
import { ProductsPageEmptyState } from "@/features/products/products-page-empty-state";
import { ProductsPageSkeleton } from "@/features/products/products-page-skeleton";
import { Page } from "@/features/shell";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { listProductsOptions } from "@/lib/tanstack-query/products";
import { CurrentUser } from "@/lib/utils/current-user";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/products/"
)({
  component: ProductsIndexPage,
  errorComponent: ProductsIndexPageError,
  pendingComponent: ProductsIndexPageSkeleton,
});

function ProductsIndexPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the products",
      }}
    />
  );
}

function ProductsIndexPageSkeleton() {
  return <ProductsPageSkeleton />;
}

function ProductsIndexPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: products } = useSuspenseQuery(
    listProductsOptions({ projectId: project.id })
  );

  return (
    <Page>
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
}
