import { cn, Logo } from '@voidhash/ui';
import type { paymentProviders } from '@/lib/payment-providers/payment-providers';
import { AppleLogo } from './logos/apple-logo';
import { StripeLogo } from './logos/stripe-logo';

export function PaymentProviderLogo({
  providerId,
  className
}: {
  providerId: ReturnType<(typeof paymentProviders)[number]['getId']>;
  className?: string;
}) {
  if (providerId === 'app-store') {
    return <AppleLogo className={className} />;
  }

  if (providerId === 'stripe') {
    return <StripeLogo className={className} />;
  }

  if (providerId === 'dev-checkout') {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md bg-primary p-1',
          className
        )}
      >
        <Logo
          className="h-full w-full text-white"
          color="mono"
          variant="symbol"
        />
      </div>
    );
  }

  return null;
}
