import { queryOptions } from "@tanstack/react-query";
import { getPaymentProvidersConfigurationsQuery } from "../../../server/queries";

export const paymentProvidersQueryKeys = {
	all: ["payment-providers"] as const,
	getPaymentProvidersConfigurations: (projectId: string) =>
		[...paymentProvidersQueryKeys.all, projectId] as const,
};

export const paymentProvidersConfigurationsQueryOptions = (
	projectId?: string
) =>
	queryOptions({
		queryKey: paymentProvidersQueryKeys.getPaymentProvidersConfigurations(
			projectId ?? "null"
		),
		queryFn: ({ signal }) =>
			getPaymentProvidersConfigurationsQuery({
				data: {
					projectId,
				},
				signal,
			}),
		enabled: !!projectId,
	});
