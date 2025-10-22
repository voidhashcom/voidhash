'use client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@voidhash/ui';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';
import { createPaymentProviderConfigurationOptions } from '@/lib/tanstack-query';

export function SetupPaymentProviderButton({
  projectId,
  providerId,
  organizationSlug,
  projectSlug
}: {
  projectId: string;
  providerId: string;
  organizationSlug: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const paymentProvider = paymentProviders.find((p) => p.id === providerId);

  const { mutate: createPaymentProviderConfiguration, status } = useMutation({
    ...createPaymentProviderConfigurationOptions(),
    onSuccess: (data) => {
      toast.success(
        `${paymentProvider?.title} configuration saved successfully`
      );
      if (data.id) {
        router.push(
          `/${organizationSlug}/${projectSlug}/settings/payment-providers/${data.id}`
        );
      } else {
        router.refresh();
      }
    },
    onError: () => {
      toast.error(`Failed to save ${paymentProvider?.title} configuration`);
    }
  });

  if (!paymentProvider) {
    return null;
  }

  return (
    <Button
      disabled={status === 'pending'}
      onClick={() =>
        createPaymentProviderConfiguration({
          projectId,
          providerId
        })
      }
      variant="outline"
    >
      Setup provider
    </Button>
  );
}
