import { Card } from '@voidhash/ui';
import { Page } from '@/features/shell';
import { PaywallRecordSkeleton } from './paywall-record-skeleton';

export function PaywallsPageSkeleton() {
  return (
    <Page>
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-row items-center justify-between">
          <h1 className="font-normal text-3xl tracking-right">Paywalls</h1>
        </div>

        <div className="mt-8">
          <Card className="grid gap-0 divide-y p-0">
            {Array.from({ length: 3 }).map((_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <PaywallRecordSkeleton key={index} />
            ))}
          </Card>
        </div>
      </div>
    </Page>
  );
}
