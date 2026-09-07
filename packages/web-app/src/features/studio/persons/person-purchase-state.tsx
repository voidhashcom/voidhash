import { useQuery } from "@tanstack/react-query";
import type { PersonPurchaseState } from "@voidhash/rpc";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voidhash/ui";
import { format, isPast } from "date-fns";
import { getPersonPurchaseStateOptions } from "@/features/studio/lib/tanstack-query/persons";

const environmentName = (environment: number) =>
  ({ 1: "Production", 2: "Sandbox", 3: "Development" })[environment] ?? "Unknown environment";

const dateLabel = (date: Date) => format(date, "MMM d, yyyy, HH:mm");

const subscriptionStatus = (subscription: PersonPurchaseState["subscriptions"][number]) => {
  if (subscription.expiresAt && isPast(subscription.expiresAt)) {
    return subscription.gracePeriodExpiresAt && !isPast(subscription.gracePeriodExpiresAt)
      ? "Grace period"
      : "Expired";
  }
  if (subscription.status === 2) return "Canceled";
  return subscription.willCancelAtPeriodEnd ? "Cancels at period end" : "Active";
};

/** Loads recorded purchase history without treating failed requests as empty history. */
export function PersonPurchaseStatePanel(props: { projectId: string; personId: string }) {
  const query = useQuery(getPersonPurchaseStateOptions(props));
  if (query.isPending) return <p role="status">Loading purchases and perks...</p>;
  if (query.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p>Could not load purchases and perks.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return <PersonPurchaseStateCards state={query.data} />;
}

/** Displays store purchase history and actual perk grants, including expired records. */
export function PersonPurchaseStateCards({ state }: { state: PersonPurchaseState }) {
  return (
    <>
      <Card className="gap-0 overflow-hidden pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Purchases</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border border-border border-t px-0">
          {state.subscriptions.length === 0 && state.purchases.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">
              Person has not made any purchases.
            </p>
          )}
          {state.subscriptions.map((subscription) => (
            <div key={subscription.id} className="space-y-2 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{subscription.productName}</span>
                <Badge variant="outline">Subscription</Badge>
                <Badge variant="outline">{environmentName(subscription.environment)}</Badge>
                <Badge variant="secondary">{subscriptionStatus(subscription)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Started {dateLabel(subscription.startsAt)}
                {subscription.expiresAt && (
                  <>
                    {" "}
                    · {isPast(subscription.expiresAt) ? "Expired" : "Expires"}{" "}
                    {dateLabel(subscription.expiresAt)}
                  </>
                )}
              </p>
            </div>
          ))}
          {state.purchases.map((purchase) => (
            <div key={purchase.id} className="space-y-2 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{purchase.productName}</span>
                <Badge variant="outline">One-time purchase</Badge>
                <Badge variant="outline">{environmentName(purchase.environment)}</Badge>
                <Badge variant="secondary">
                  {purchase.revokedAt ? "Revoked" : purchase.refundedAt ? "Refunded" : "Purchased"}
                </Badge>
              </div>
              {purchase.createdAt && (
                <p className="text-sm text-muted-foreground">
                  Purchased {dateLabel(purchase.createdAt)}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="gap-0 overflow-hidden pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Perks</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border border-border border-t px-0">
          {state.grants.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">Person has no unlocked perks.</p>
          )}
          {state.grants.map((grant) => (
            <div key={grant.id} className="space-y-2 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{grant.perkName}</span>
                <Badge variant="outline">{environmentName(grant.environment)}</Badge>
                <Badge variant="secondary">
                  {grant.status === 2 || (grant.expiresAt && isPast(grant.expiresAt))
                    ? "Expired"
                    : "Active"}
                </Badge>
              </div>
              {grant.expiresAt && (
                <p className="text-sm text-muted-foreground">
                  {isPast(grant.expiresAt) ? "Expired" : "Expires"} {dateLabel(grant.expiresAt)}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
