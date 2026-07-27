import { DataTableSkeleton, Page, PageBar, PageHeader, PageHeaderTitle } from "@voidhash/ui";

/** Loading shell matching the A/B test index layout. */
export function ExperimentsPageSkeleton() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>A/B Tests</PageHeaderTitle>
      </PageHeader>
      <PageBar className="pl-2">
        <div className="flex items-center gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <div className="h-5 w-14 rounded bg-muted" key={index} />
          ))}
        </div>
      </PageBar>
      <div className="w-full px-4 pt-4">
        <DataTableSkeleton />
      </div>
    </Page>
  );
}
