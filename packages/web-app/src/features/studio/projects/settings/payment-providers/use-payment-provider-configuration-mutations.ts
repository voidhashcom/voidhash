"use client";

import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useConfirmDialog } from "@voidhash/ui";
import { toast } from "sonner";
import {
  deletePaymentProviderConfigurationOptions,
  updatePaymentProviderConfigurationOptions,
} from "@/features/studio/lib/tanstack-query";

export function usePaymentProviderConfigurationMutations({
  organizationSlug,
  projectSlug,
  providerTitle,
}: {
  organizationSlug: string;
  projectSlug: string;
  providerTitle: string;
}) {
  const navigate = useNavigate();
  const { ConfirmationDialog, openDialog } = useConfirmDialog();

  const { mutate: updateConfiguration, status: updateStatus } = useMutation({
    ...updatePaymentProviderConfigurationOptions(),
    onSuccess: () => {
      toast.success(`${providerTitle} configuration saved successfully`);
    },
    onError: () => {
      toast.error(`Failed to save ${providerTitle} configuration`);
    },
  });

  const { mutateAsync: deletePaymentProviderConfiguration, status: deleteStatus } = useMutation({
    ...deletePaymentProviderConfigurationOptions(),
    onSuccess: () => {
      toast.success(`${providerTitle} configuration deleted successfully`);
      void navigate({
        params: {
          organizationSlug,
          projectSlug,
        },
        to: "/studio/$organizationSlug/$projectSlug/settings/payment-providers",
      });
    },
    onError: () => {
      toast.error(`Failed to delete ${providerTitle} configuration`);
    },
  });

  const deleteConfiguration = async (id: string) => {
    const confirmed = await openDialog({
      description: "Are you sure you want to delete this payment provider?",
      title: "Delete payment provider",
    });

    if (!confirmed) {
      return;
    }

    await deletePaymentProviderConfiguration({
      paymentProviderConfigurationId: id,
    });
  };

  return {
    ConfirmationDialog,
    deleteConfiguration,
    isDeleting: deleteStatus === "pending",
    isSaving: updateStatus === "pending",
    openDialog,
    updateConfiguration,
  };
}
