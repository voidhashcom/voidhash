"use client";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@voidhash/ui";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { paymentProviders } from "@/features/studio/lib/payment-providers/payment-providers";
import { createPaymentProviderConfigurationOptions } from "@/features/studio/lib/tanstack-query";

export function PaymentProvidersNewStoreDropdown({
  configuredProviderIds = [],
  project,
  organizationSlug,
  projectSlug,
}: {
  configuredProviderIds?: readonly string[];
  project: { id: string };
  organizationSlug: string;
  projectSlug: string;
}) {
  const navigate = useNavigate();
  const configuredProviderIdSet = new Set(configuredProviderIds);

  const { mutate: createPaymentProviderConfiguration, status } = useMutation({
    ...createPaymentProviderConfigurationOptions(),
    onSuccess: (data) => {
      toast.success("Payment provider configuration created successfully");
      void navigate({
        params: {
          organizationSlug,
          paymentProviderConfigurationId: data.id,
          projectSlug,
        },
        to: "/studio/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId",
      });
    },
    onError: () => {
      toast.error("Failed to create payment provider configuration");
    },
  });

  const handleCreatePaymentProviderConfiguration = (providerId: string) => {
    createPaymentProviderConfiguration({
      projectId: project.id,
      providerId,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <PlusIcon className="h-4 w-4" />
          Add store
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {paymentProviders
          .filter((p) => p.type === "native")
          .map((p) => {
            const isConfigured = configuredProviderIdSet.has(p.id);

            return (
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={status === "pending" || isConfigured}
                key={p.id}
                onClick={() => {
                  if (!isConfigured) {
                    handleCreatePaymentProviderConfiguration(p.id);
                  }
                }}
              >
                {p.title}
                {isConfigured ? (
                  <span className="ml-auto text-muted-foreground text-xs">Added</span>
                ) : null}
              </DropdownMenuItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
