import { Skeleton } from "@voidhash/ui";
import { SettingsCard, SettingsPage, SettingsSection } from "@/features/studio/settings";
import { paymentProviders } from "@/features/studio/lib/payment-providers/payment-providers";

export function PaymentProvidersPageSkeleton() {
  return (
    <SettingsPage title="Payment Providers">
      <SettingsSection title="Stores">
        <SettingsCard>
          {paymentProviders.slice(0, 2).map((paymentProvider) => (
            <div
              className="flex items-center gap-3 border-border/60 border-t px-5 py-3.5 first:border-t-0"
              key={paymentProvider.id}
            >
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}
