import { AppProviders } from "./providers";

export default function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <AppProviders>{children}</AppProviders>;
}
