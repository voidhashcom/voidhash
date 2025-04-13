import { Logo } from "@voidhash/ui";
import Link from "next/link";

export function NavBarLogo({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string | null;
	projectSlug: string | null;
}) {
	const homeLink = (() => {
		if (organizationSlug && !projectSlug) {
			return {
				href: `/~/${organizationSlug}/projects`,
			} as const;
		}
		if (organizationSlug && projectSlug) {
			return {
				href: `/~/${organizationSlug}/${projectSlug}`,
			} as const;
		}
		return {
			href: "/",
		} as const;
	})();

	return (
		<Link href={homeLink?.href}>
			<Logo variant="symbol" className="h-4 ml-2" color="mono" />
		</Link>
	);
}
