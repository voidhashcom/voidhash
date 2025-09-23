'use client';
import { Button } from '@voidhash/ui';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { toast } from 'sonner';
import { createPaymentProviderConfigurationAction } from '@/lib/nextjs/server-actions';
import { paymentProviders } from '@/lib/payment-providers/payment-providers';

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

  const { execute, isPending } = useAction(
    createPaymentProviderConfigurationAction,
    {
      onSuccess: (res) => {
        toast.success(
          `${paymentProvider?.title} configuration saved successfully`
        );

        if (res.data?.id) {
          router.push(
            `/${organizationSlug}/${projectSlug}/settings/payment-providers/${res.data.id}`
          );
        } else {
          router.refresh();
        }
      },
      onError: (error) => {
        toast.error(
          error.error.serverError ??
            `Failed to save ${paymentProvider?.title} configuration. Please try again.`
        );
      }
    }
  );

  const paymentProvider = paymentProviders.find((p) => p.id === providerId);

  if (!paymentProvider) {
    return null;
  }

  return (
    <Button
      disabled={isPending}
      onClick={() =>
        execute({
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
