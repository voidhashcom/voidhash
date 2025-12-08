import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@voidhash/ui';
import { format } from 'date-fns';
import { Clock4Icon } from 'lucide-react';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { getCustomerByIdOptions } from '@/lib/tanstack-query/customers';

export const Route = createFileRoute(
  '/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/customers/$id'
)({
  pendingComponent: CustomerDetailPageSkeleton,
  errorComponent: CustomerDetailPageError,
  component: CustomerDetailPage
});

function CustomerDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred loading the customer'
      }}
    />
  );
}

function CustomerDetailPageSkeleton() {
  return <Page className="p-0 py-8 pt-3">Loading customer...</Page>;
}

function CustomerDetailPage() {
  const { id: customerId, organizationSlug, projectSlug } = Route.useParams();

  const { data: customer } = useSuspenseQuery(
    getCustomerByIdOptions({ customerId: customerId as string })
  );

  const title =
    customer.name ?? customer.email ?? customer.appUserId ?? customer.id;

  return (
    <Page
      breadcrumbs={[
        {
          title: 'Customers',
          url: `/${organizationSlug}/${projectSlug}/customers`
        },
        {
          title,
          url: `/${organizationSlug}/${projectSlug}/customers/${customerId}`
        }
      ]}
      className="p-0 py-8 pt-3"
    >
      <div className="border-border border-b">
        <div className="mx-auto max-w-6xl pb-10">
          <div className="flex flex-row items-center justify-between">
            <h1 className="font-normal text-3xl tracking-right">{title}</h1>
          </div>
          {customer.email && (
            <p className="mt-3 text-muted-foreground">{customer.email}</p>
          )}
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl ">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-9">
            <div className="mt-8">
              <Card className="mt-8 gap-0 overflow-hidden pb-0">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-4">
                    Purchases
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border border-border border-t px-0">
                  <div className="flex h-full flex-col items-center justify-center py-6">
                    <div className="text-muted-foreground">
                      Customer has not made any purchases.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-8">
                <Card className="mt-8 gap-0 overflow-hidden pb-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-4">
                      Unlocked Perks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border border-border border-t px-0">
                    <div className="flex h-full flex-col items-center justify-center py-6">
                      <div className="text-muted-foreground">
                        Customer has no unlocked perks.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
          <div className="col-span-3 mt-8">
            <h2 className=" font-semibold text-xl tracking-normal tracking-right">
              Details
            </h2>
            <div className="mt-4">
              {customer.createdAt && (
                <div>
                  <p className="font-semibold">Created at</p>
                  <div className="mt-1 flex flex-row items-center gap-2">
                    <Clock4Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {format(customer.createdAt, 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
