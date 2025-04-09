import { TRPCReactProvider } from "@voidhash/features/trpc/react";
import { Toaster } from "@voidhash/ui";

export function AppProviders({ children }: { children: React.ReactNode }) {
	return (
		<TRPCReactProvider>
			{children}
			<Toaster />
		</TRPCReactProvider>
	);
}
