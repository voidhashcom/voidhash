import { useQuery } from "@tanstack/react-query";
import { customersQueryOptions } from "../query-utils";

export function useCustomers(projectId?: string | null) {
	return useQuery(customersQueryOptions(projectId));
}
