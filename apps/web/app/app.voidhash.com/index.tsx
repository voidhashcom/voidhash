"use client";

import { useMe } from "@voidhash/features/auth/client/hooks/useMe";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function Index() {
	const { data: me, isLoading } = useMe();
	const router = useRouter();

	useEffect(() => {
		if (!isLoading && me) {
			if (me.organizations.length == 0) {
				router.push("/create-org");
			} else {
				router.push(`/~/${me.organizations[0]!.slug}`);
			}
		} else if (!isLoading && !me) {
			router.push("/login");
		}
	}, [me, isLoading, router]);

	return <div></div>;
}
