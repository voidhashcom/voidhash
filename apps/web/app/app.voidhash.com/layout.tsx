import { AppProviders } from "./providers";

export default function AppLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <AppProviders>{children}</AppProviders>;
}
