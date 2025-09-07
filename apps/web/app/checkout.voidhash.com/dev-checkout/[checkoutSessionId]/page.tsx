import { checkoutSessions, db, eq } from '@voidhash/db';
import { Card, Logo } from '@voidhash/ui';
import { CheckoutButtons } from './checkout-buttons';

export default async function CheckoutPage({
  params
}: {
  params: Promise<{ checkoutSessionId: string }>;
}) {
  const { checkoutSessionId } = await params;

  const checkoutSession = await db.query.checkoutSessions.findFirst({
    where: eq(checkoutSessions.id, checkoutSessionId),
    with: {
      paymentProviderConfigurationProduct: {
        with: {
          product: true
        }
      }
    }
  });

  if (!checkoutSession) {
    return <div>Checkout session not found</div>;
  }

  return (
    <div className="mx-auto flex h-screen max-w-md items-end justify-center bg-background md:items-center">
      <Card className="fixed right-0 bottom-0 left-0 flex w-full flex-col gap-4 p-4 md:relative md:right-auto md:left-auto ">
        <Logo className="w-24" />
        <h1 className="font-semibold text-2xl">Purchase (Test)</h1>
        <div className="rounded-md border border-border bg-muted p-4">
          <p>
            You are about to purchase{' '}
            <span className="font-semibold">
              {checkoutSession.paymentProviderConfigurationProduct.product.name}
            </span>
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          You won&apos;t be charged for this purchase.
        </p>
        <CheckoutButtons checkoutSessionId={checkoutSessionId} />
      </Card>
    </div>
  );
}
