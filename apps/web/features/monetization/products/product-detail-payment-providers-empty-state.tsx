import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Button,
} from "@voidhash/ui";
import Link from "next/link";

export function ProductDetailPaymentProvidersEmptyState({
	projectSlug,
	organizationSlug,
}: { projectSlug: string; organizationSlug: string }) {
	return (
		<Card className="max-w-5xl mx-auto w-full text-center">
			<CardHeader>
				<CardTitle>No payment providers enabled</CardTitle>
				<CardDescription>
					Setup and enable at least one payment provider before proceeding.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Link
					href={`/${organizationSlug}/${projectSlug}/monetization/payment-providers`}
				>
					<Button>Setup payment providers</Button>
				</Link>
			</CardContent>
		</Card>
	);
}
