"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../../trpc/react";

export function useMe() {
	const trpc = useTRPC();
	return useQuery(trpc.auth.me.queryOptions());
}
