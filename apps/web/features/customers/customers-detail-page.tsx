import { Card, CardContent, CardHeader, CardTitle } from '@voidhash/ui';
import { format } from 'date-fns';
import { Effect } from 'effect';
import { Clock4Icon } from 'lucide-react';
import { NotFoundError } from '@/lib/effect/errors';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { CustomerService } from '@/lib/services/customer.service';
import { Page } from '../shell';
import { VoidhashErrorCard } from '../shell/components/voidhash-error-card';

export async function CustomerDetailPage({
  customerId,
  organizationSlug,
  projectSlug
}: {
  customerId: string;
  organizationSlug: string;
  projectSlug: string;
}) {
  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const customerService = yield* CustomerService;
          const customer = yield* customerService.getCustomerById(customerId);
          const customerPurchases =
            yield* customerService.getCustomerPurchases(customerId);
          const customerUnlockedPerks =
            yield* customerService.getCustomersUnlockedPerks(customerId);
          return { customer, customerPurchases, customerUnlockedPerks };
        }).pipe(
          Effect.catchTags({
            CustomerNotFoundError: (error) =>
              Effect.fail(new NotFoundError({ message: error.message }))
          })
        )
      );
    })
  );

  if (data.isErr()) {
    return <VoidhashErrorCard error={data._unsafeUnwrapErr()} />;
  }

  const { customer, customerPurchases, customerUnlockedPerks } = data.value;

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
                  {/* Emtpy State */}
                  {customerPurchases.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center py-6">
                      <div className="text-muted-foreground">
                        Customer has not made any purchases.
                      </div>
                    </div>
                  )}

                  {customerPurchases.map((purchase) => (
                    <div key={purchase.id}>{purchase.id}</div>
                  ))}
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
                    {/* Emtpy State */}
                    {customerUnlockedPerks.length === 0 && (
                      <div className="flex h-full flex-col items-center justify-center py-6">
                        <div className="text-muted-foreground">
                          Customer has no unlocked perks.
                        </div>
                      </div>
                    )}

                    {customerUnlockedPerks.map((unlockedPerk) => (
                      <div key={unlockedPerk.id}>{unlockedPerk.id}</div>
                    ))}
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
