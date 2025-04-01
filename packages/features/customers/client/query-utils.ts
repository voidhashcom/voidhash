import { queryOptions } from "@tanstack/react-query";

import { getCustomersQuery } from "../server/queries";

export const customersQueryKeys = {
	all: ["customers"] as const,
	getCustomers: (projectId?: string | null) =>
		[...customersQueryKeys.all, projectId] as const,
};

export const customersQueryOptions = (projectId?: string | null) =>
	queryOptions({
		queryKey: customersQueryKeys.getCustomers(projectId),
		queryFn: ({ signal }) =>
			projectId === null
				? []
				: getCustomersQuery({
						data: { projectId },
						signal,
					}),
	});
