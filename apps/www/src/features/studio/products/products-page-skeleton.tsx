import { Page, PageHeader, PageHeaderTitle, Skeleton } from "@voidhash/ui";

import { ProductRecordSkeleton } from "./product-record-skeleton";

export function ProductsPageSkeleton() {
  return (
    <Page className="flex h-[calc(100svh-var(--header-height))] flex-row overflow-hidden">
      <div className="flex w-[22rem] shrink-0 flex-col border-border/60 border-r">
        <PageHeader>
          <PageHeaderTitle>Products</PageHeaderTitle>
        </PageHeader>
        <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
          {Array.from({ length: 3 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <ProductRecordSkeleton key={index} />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader>
          <Skeleton className="h-4 w-40" />
        </PageHeader>
        <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </Page>
  );
}
