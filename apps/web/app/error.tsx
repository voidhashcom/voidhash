"use client"; // Error boundaries must be Client Components

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorCard } from "@voidhash/ui";
export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const [initialized, setInitialized] = useState(false);
	useEffect(() => {
		console.log(error.name, typeof error.name);
		if (error.name === "VoidhashError:UNAUTHORIZED" && pathname !== "/login") {
			console.log("Redirecting to login");
			router.push("/login");
		}

		console.error(error);
		setInitialized(true);
	}, [error, pathname, router]);

	if (!initialized) {
		return <div>Loading...</div>;
	}

	return (
		<ErrorCard
			title="Something went wrong!"
			description="Please try again"
			onRetry={() => reset()}
			className="h-screen"
		/>
	);
}
