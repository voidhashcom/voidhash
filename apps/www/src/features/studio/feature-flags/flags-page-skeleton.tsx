import { Card, Page, PageHeader, PageHeaderTitle } from "@voidhash/ui";

import { FlagRecordSkeleton } from "./flag-record-skeleton";

export function FlagsPageSkeleton() {
  return (
    <Page>
      <PageHeader>
        <PageHeaderTitle>Feature Flags</PageHeaderTitle>
      </PageHeader>
      <div className="mx-auto w-full max-w-4xl px-4 pt-4">
        <Card className="grid gap-0 divide-y p-0">
          {Array.from({ length: 4 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <FlagRecordSkeleton key={index} />
          ))}
        </Card>
      </div>
    </Page>
  );
}
