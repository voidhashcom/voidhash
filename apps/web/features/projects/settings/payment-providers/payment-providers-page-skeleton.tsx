import { Card, Skeleton } from '@voidhash/ui';
import { Page } from '@/features/shell';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';

export function PaymentProvidersPageSkeleton() {
  return (
    <Page>
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <h1 className="font-normal text-3xl tracking-right">
          Payment Providers
        </h1>
        <p className="mt-3 text-muted-foreground">
          Configure your payment providers
        </p>
        <div className="mt-8">
          <Card className="grid gap-0 divide-y p-0">
            {paymentProviders?.map((paymentProvider) => (
              <div
                className="group relative isolate px-6 py-4 hover:bg-accent/30"
                key={paymentProvider.getId()}
              >
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-1 items-center gap-4">
                    <div className="h-8 w-8">
                      <Skeleton className="h-full w-full" />
                    </div>
                    <div className="flex flex-col">
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Page>
  );
}
