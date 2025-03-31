import { useQuery } from "@tanstack/react-query";
import { getMe } from "../../server/queries";
import { authQueryKeys } from "../query-keys";

export function useMe() {
	return useQuery({
		queryKey: authQueryKeys.me(),
		queryFn: () => getMe(),
	});
}
