import { Effect } from "effect";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/studio/components/auth-context";

import { ProductDetailBody } from "@/features/studio/products/product-detail-body";
import { ProductsDetailPageSkeleton } from "@/features/studio/products/product-detail-page-skeleton";
import { Page } from "@/features/studio/shell";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { getProductOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/products/$id",
)({
  component: ProductDetailPage,
  errorComponent: ProductDetailPageError,
  pendingComponent: ProductDetailPageSkeleton,
});

function ProductDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the product",
      }}
    />
  );
}

function ProductDetailPageSkeleton() {
  return <ProductsDetailPageSkeleton />;
}

function ProductDetailPage() {
  const { id, organizationSlug, projectSlug } = Route.useParams();

  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return Effect.runSync(Effect.die(new Error("Project not found")));
  }

  const { data: product } = useSuspenseQuery(getProductOptions({ productId: id as string }));

  return (
    <Page
      breadcrumbs={[
        {
          title: "Products",
          url: `/${organizationSlug}/${projectSlug}/products`,
        },
        {
          title: product.name,
          url: `/${organizationSlug}/${projectSlug}/products/${id}`,
        },
      ]}
      className="p-0 py-8"
    >
      <div className="border-border border-b">
        <div className="mx-auto max-w-4xl pb-10 pt-4">
          <div className="flex flex-row items-center justify-between">
            <h1 className="font-normal text-3xl tracking-right">{product.name}</h1>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-4xl">
        <ProductDetailBody
          organizationSlug={organizationSlug as string}
          productId={product.id}
          projectId={project.id}
          projectSlug={projectSlug as string}
        />
      </div>
    </Page>
  );
}
