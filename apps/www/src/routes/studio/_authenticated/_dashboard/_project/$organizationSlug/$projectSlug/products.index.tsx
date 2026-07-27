import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";
import { PackageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/studio/components/auth-context";

import { CreateProductModalButton } from "@/features/studio/products/create-product-modal-button";
import { ProductDetailPane } from "@/features/studio/products/product-detail-pane";
import { ProductRecord } from "@/features/studio/products/product-record";
import { ProductRecordConfigurationStateIndicator } from "@/features/studio/products/product-record-configuration-state-indicator";
import { ProductsPageEmptyState } from "@/features/studio/products/products-page-empty-state";
import { ProductsPageSkeleton } from "@/features/studio/products/products-page-skeleton";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { listProductsOptions } from "@/features/studio/lib/tanstack-query/products";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/products/",
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
    projectSlug as string,
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: products } = useSuspenseQuery(listProductsOptions({ projectId: project.id }));

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    // Clear the selection if the active product is removed (e.g. deleted via
    // the right-pane actions), so the empty state takes over.
    if (selectedProductId === null) {
      return;
    }
    if (!products.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(null);
    }
  }, [products, selectedProductId]);

  if (products.length === 0) {
    return (
      <Page>
        <PageHeader>
          <PageHeaderTitle>Products</PageHeaderTitle>
        </PageHeader>
        <div className="mx-auto w-full max-w-4xl px-4 pt-4">
          <ProductsPageEmptyState projectId={project.id} />
        </div>
      </Page>
    );
  }

  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-row overflow-hidden">
      <div className="flex w-[22rem] shrink-0 flex-col border-border/60 border-r">
        <PageHeader rightActions={<CreateProductModalButton iconOnly projectId={project.id} />}>
          <PageHeaderTitle>Products</PageHeaderTitle>
        </PageHeader>
        <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
          {products.map((product) => (
            <ProductRecord
              configurationStateIndicator={
                <ProductRecordConfigurationStateIndicator
                  productId={product.id}
                  projectId={project.id}
                />
              }
              isSelected={product.id === selectedProductId}
              key={product.id}
              onSelect={setSelectedProductId}
              product={product}
            />
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {selectedProductId ? (
          <ProductDetailPane
            onDeleted={() => setSelectedProductId(null)}
            organizationSlug={organizationSlug as string}
            productId={selectedProductId}
            projectId={project.id}
            projectSlug={projectSlug as string}
          />
        ) : (
          <ProductDetailEmptyState />
        )}
      </div>
    </Page>
  );
}

function ProductDetailEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <PackageIcon aria-hidden className="size-10 text-muted-foreground/50" strokeWidth={1.25} />
      <p className="mt-4 text-muted-foreground text-sm">Select a product to view its details</p>
    </div>
  );
}
