import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../trpc/react";

export function useCustomers(projectId?: string | null) {
	const trpc = useTRPC();
	return useQuery(
		trpc.customers.getCustomers.queryOptions(
			{
				projectId: projectId ?? "",
			},
			{
				enabled: !!projectId,
			}
		)
	);
}
