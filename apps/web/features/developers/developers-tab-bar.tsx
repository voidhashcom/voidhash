"use client";
import {
	UnderlineTabs,
	UnderlineTabsList,
	UnderlineTabsTrigger,
} from "@voidhash/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DevelopersTabBar({
	tabs,
}: { tabs: { label: string; path: string }[] }) {
	const pathname = usePathname();
	return (
		<UnderlineTabs value={pathname}>
			<UnderlineTabsList>
				{tabs.map((tab) => (
					<UnderlineTabsTrigger
						disabled
						key={tab.path}
						value={tab.path}
						asChild
					>
						<Link href={tab.path}>{tab.label}</Link>
					</UnderlineTabsTrigger>
				))}
			</UnderlineTabsList>
		</UnderlineTabs>
	);
}
