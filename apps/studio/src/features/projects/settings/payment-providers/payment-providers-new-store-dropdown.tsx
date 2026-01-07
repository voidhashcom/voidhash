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
import { paymentProviders } from "src/lib/payment-providers/payment-providers";
import { createPaymentProviderConfigurationOptions } from "src/lib/tanstack-query";

export function PaymentProvidersNewStoreDropdown({
  project,
  organizationSlug,
  projectSlug,
}: {
  project: { id: string };
  organizationSlug: string;
  projectSlug: string;
}) {
  const navigate = useNavigate();

  const { mutate: createPaymentProviderConfiguration, status } = useMutation({
    ...createPaymentProviderConfigurationOptions(),
    onSuccess: (data) => {
      toast.success("Payment provider configuration created successfully");
      navigate({
        params: {
          organizationSlug,
          paymentProviderConfigurationId: data.id,
          projectSlug,
        },
        to: "/$organizationSlug/$projectSlug/settings/payment-providers/$paymentProviderConfigurationId",
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
        <Button>
          <PlusIcon className="h-4 w-4" />
          Add New Store
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {paymentProviders
          .filter((p) => p.type === "native")
          .map((p) => (
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={status === "pending"}
              key={p.id}
              onClick={() => {
                handleCreatePaymentProviderConfiguration(p.id);
              }}
            >
              {p.title}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
