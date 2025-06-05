import { Spinner } from "@voidhash/ui";

export default function LoginLoading() {
	return (
		<div className="flex w-screen h-screen items-center justify-center">
			<Spinner className="w-6 h-6" />
		</div>
	);
}
