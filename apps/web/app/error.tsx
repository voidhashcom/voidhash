"use client"; // Error boundaries must be Client Components

// import { VoidhashError } from "@voidhash/lib/constants";
// import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	// const router = useRouter();
	useEffect(() => {
		// console.log("VOIDHASH ERROR", JSON.stringify(error, null, 2));
		// if (error instanceof VoidhashError) {
		// 	if (error.code === "UNAUTHORIZED") {
		// 		router.push("/login");
		// 	}
		// 	// Log the error to an error reporting service
		// }
		if (error instanceof Error) {
			console.error(error);
		}
	}, [error]);

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
