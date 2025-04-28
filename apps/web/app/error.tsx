"use client"; // Error boundaries must be Client Components

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
	}, [error, pathname]);

	if (!initialized) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<h2>Something went wrong!</h2>
			<button
				onClick={
					// Attempt to recover by trying to re-render the segment
					() => reset()
				}
			>
				Try again
			</button>
		</div>
	);
}
