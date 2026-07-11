"use client";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@voidhash/ui";
import { toast } from "sonner";
import { paymentProviders } from "@/features/studio/lib/payment-providers/payment-providers";
import { createPaymentProviderConfigurationOptions } from "@/features/studio/lib/tanstack-query";

export function SetupPaymentProviderButton({
  projectId,
  providerId,
  organizationSlug,
  projectSlug,
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
      toast.success(`${paymentProvider?.title} configuration saved successfully`);
      if (data.id) {
        navigate({
          params: {
            organizationSlug,
            paymentProviderConfigurationId: data.id,
            projectSlug,
          },
          to: "/studio/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId",
        });
      }
    },
    onError: () => {
      toast.error(`Failed to save ${paymentProvider?.title} configuration`);
    },
  });

  if (!paymentProvider) {
    return null;
  }

  return (
    <Button
      disabled={status === "pending"}
      onClick={() =>
        createPaymentProviderConfiguration({
          projectId,
          providerId,
        })
      }
      size="sm"
      variant="outline"
    >
      Set up
    </Button>
  );
}
