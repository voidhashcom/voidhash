import { Card } from '@voidhash/ui';
import { PaywallLocationRecordSkeleton } from './paywall-location-record-skeleton';

export function PaywallLocationsPageSkeleton() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">
            Paywall Locations
          </h2>
          <p className="mt-1 text-muted-foreground">
            Places throughout your app where paywalls can be shown.
          </p>
        </div>
      </div>
      <div className="mt-8">
        <Card className="grid gap-0 divide-y p-0">
          {Array.from({ length: 3 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: just a skeleton
            <PaywallLocationRecordSkeleton key={index} />
          ))}
        </Card>
      </div>
    </div>
  );
}
