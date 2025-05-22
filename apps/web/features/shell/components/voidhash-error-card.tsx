import { AnyVoidhashError } from "@voidhash/lib/constants";
import { ErrorCard } from "@voidhash/ui";

export function VoidhashErrorCard({ error }: { error: AnyVoidhashError }) {
	// TODO: Improve this a lot
	return (
		<ErrorCard
			title="Something went wrong"
			description={error.message}
			className="h-screen"
			onRetry={() => {
				window.location.reload();
			}}
		/>
	);
}
