"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useAuth } from "@/features/studio/components/auth-context";
import { Page } from "@/features/studio/shell";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { getPaymentProviderConfigurationOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

import { PaymentProviderDetailRouter } from "./payment-provider-detail-router";

export const PaymentProviderDetailPage = () => {
  const params = useParams();
  const organizationSlug = params.organizationSlug as string;
  const projectSlug = params.projectSlug as string;
  const paymentProviderConfigurationId = params.paymentProviderConfigurationId as string;

  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  const { data: paymentProviderConfiguration, status: paymentProviderConfigurationStatus } =
    useQuery({
      ...getPaymentProviderConfigurationOptions({
        id: paymentProviderConfigurationId,
      }),
      enabled: !!paymentProviderConfigurationId,
    });

  if (paymentProviderConfigurationStatus === "pending") {
    return <div>Loading...</div>;
  }

  if (paymentProviderConfigurationStatus === "error" || !project || !paymentProviderConfiguration) {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occured loading the payment provider configuration",
        }}
      />
    );
  }

  return (
    <Page
      breadcrumbs={[
        {
          title: "Payment Providers",
          url: `/${organizationSlug}/${projectSlug}/settings/payment-providers`,
        },
        {
          title: paymentProviderConfiguration.name,
          url: `/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`,
        },
      ]}
      className="flex flex-1 flex-col p-0 pt-3 pb-0"
    >
      <PaymentProviderDetailRouter
        organizationSlug={organizationSlug}
        paymentProviderConfiguration={paymentProviderConfiguration}
        project={project}
        projectSlug={projectSlug}
      />
    </Page>
  );
};
