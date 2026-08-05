import { SettingsCardSkeleton, Skeleton } from "@voidhash/ui";
import { Page } from "@/features/studio/shell";

export function ProductsDetailPageSkeleton() {
  return (
    <Page
      breadcrumbs={[
        {
          title: "Products",
        },
        {
          isLoading: true,
          title: "Product",
        },
      ]}
    >
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-row items-center justify-between">
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="mt-8">
          {Array.from({ length: 2 }).map((_, index) => (
            <SettingsCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </Page>
  );
}
