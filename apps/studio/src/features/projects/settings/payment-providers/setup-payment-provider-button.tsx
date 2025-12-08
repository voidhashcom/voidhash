'use client';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@voidhash/ui';
import { toast } from 'sonner';
import { paymentProviders } from 'src/lib/payment-providers/payment-providers';
import { createPaymentProviderConfigurationOptions } from 'src/lib/tanstack-query';

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
  const navigate = useNavigate();
  const paymentProvider = paymentProviders.find((p) => p.id === providerId);

  const { mutate: createPaymentProviderConfiguration, status } = useMutation({
    ...createPaymentProviderConfigurationOptions(),
    onSuccess: (data) => {
      toast.success(
        `${paymentProvider?.title} configuration saved successfully`
      );
      if (data.id) {
        navigate({
          to: '/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId',
          params: {
            organizationSlug,
            projectSlug,
            paymentProviderConfigurationId: data.id
          }
        });
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
