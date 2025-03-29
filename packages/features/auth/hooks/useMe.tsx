import { useQuery } from "@tanstack/react-query";
import { authQueryKeys } from "../query-keys";
import { getMe } from "../server/queries";

export function useMe() {
	return useQuery({
		queryKey: authQueryKeys.me(),
		queryFn: () => getMe(),
	});
}
