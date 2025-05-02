"use client";
import { TRPCReactProvider } from "@/features/trpc/react";
import { Toaster } from "@voidhash/ui";
import { Next13ProgressBar } from "next13-progressbar";
export function AppProviders({ children }: { children: React.ReactNode }) {
	return (
		<TRPCReactProvider>
			{children}
			<Toaster />
			<Next13ProgressBar
				height="2px"
				color="#005EFF"
				options={{ showSpinner: false }}
				showOnShallow
			/>
		</TRPCReactProvider>
	);
}
