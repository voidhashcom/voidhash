import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { Page } from "../shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { getPurchases } from "@/lib/services/purchases/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@voidhash/ui";
import { format } from "date-fns";
import { Clock4Icon } from "lucide-react";
import { VoidhashErrorCard } from "../shell/components/voidhash-error-card";
import { tryCatch } from "@/lib/try-catch";
import { NextjsRuntime } from "@/lib/effect/runtimes/nextjs";
import { CustomerService } from "@/lib/services/customers/customer.service";
import { Effect, pipe } from "effect";

export async function CustomerDetailPage({
	customerId,
	organizationSlug,
	projectSlug,
}: {
	customerId: string;
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	if (project.isErr()) {
		const error = project._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const customerPromise = tryCatch(
		NextjsRuntime.runPromise(
			pipe(
				CustomerService,
				Effect.flatMap((customerService) =>
					customerService.getCustomerById(customerId)
				)
			)
		)
	);

	const customerPurchasesPromise = getPurchases({
		ctx: serviceContext,
		input: { projectId: project.value.id, customerId },
	});

	const customerUnlockedPerksPromise = tryCatch(
		NextjsRuntime.runPromise(
			pipe(
				CustomerService,
				Effect.flatMap((customerService) =>
					customerService.getCustomersUnlockedPerks(customerId)
				)
			)
		)
	);

	const [customerResult, customerPurchasesResult, customerUnlockedPerksResult] =
		await Promise.all([
			customerPromise,
			customerPurchasesPromise,
			customerUnlockedPerksPromise,
		]);

	if (customerResult.error) {
		return <VoidhashErrorCard error={customerResult.error} />;
	}

	if (customerPurchasesResult.isErr()) {
		const error = customerPurchasesResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	if (customerUnlockedPerksResult.error) {
		return <VoidhashErrorCard error={customerUnlockedPerksResult.error} />;
	}

	const customer = customerResult.data;
	const customerPurchases = customerPurchasesResult.value;
	const customerUnlockedPerks = customerUnlockedPerksResult.data;

	const title =
		customer.name ?? customer.email ?? customer.appUserId ?? customer.id;

	return (
		<Page
			className="p-0 py-8 pt-3"
			breadcrumbs={[
				{
					title: "Customers",
					url: `/${organizationSlug}/${projectSlug}/customers`,
				},
				{
					title: title,
					url: `/${organizationSlug}/${projectSlug}/customers/${customerId}`,
				},
			]}
		>
			<div className="border-b border-border">
				<div className="max-w-6xl mx-auto  pb-10">
					<div className="flex flex-row items-center justify-between">
						<h1 className="text-3xl font-normal tracking-right">{title}</h1>
					</div>
					{customer.email && (
						<p className="text-muted-foreground mt-3">{customer.email}</p>
					)}
				</div>
			</div>
			<div className="max-w-6xl mx-auto mt-3 ">
				<div className="grid grid-cols-12 gap-8">
					<div className="col-span-9">
						<div className="mt-8">
							<Card className="pb-0 overflow-hidden mt-8 gap-0">
								<CardHeader className="pb-4">
									<CardTitle className="flex items-center gap-4">
										Purchases
									</CardTitle>
								</CardHeader>
								<CardContent className="border-t border-border divide-y divide-border px-0">
									{/* Emtpy State */}
									{customerPurchases.purchases.length === 0 && (
										<div className="flex flex-col items-center justify-center h-full py-6">
											<div className="text-muted-foreground">
												Customer has not made any purchases.
											</div>
										</div>
									)}

									{customerPurchases.purchases.map((purchase) => (
										<div key={purchase.id}>{purchase.id}</div>
									))}
								</CardContent>
							</Card>

							<div className="mt-8">
								<Card className="pb-0 overflow-hidden mt-8 gap-0">
									<CardHeader className="pb-4">
										<CardTitle className="flex items-center gap-4">
											Unlocked Perks
										</CardTitle>
									</CardHeader>
									<CardContent className="border-t border-border divide-y divide-border px-0">
										{/* Emtpy State */}
										{customerUnlockedPerks.length === 0 && (
											<div className="flex flex-col items-center justify-center h-full py-6">
												<div className="text-muted-foreground">
													Customer has no unlocked perks.
												</div>
											</div>
										)}

										{customerUnlockedPerks.map((unlockedPerk) => (
											<div key={unlockedPerk.id}>{unlockedPerk.id}</div>
										))}
									</CardContent>
								</Card>
							</div>
						</div>
					</div>
					<div className="col-span-3 mt-8">
						<h2 className=" tracking-right font-semibold tracking-normal text-xl">
							Details
						</h2>
						<div className="mt-4">
							{customer.createdAt && (
								<div>
									<p className="font-semibold">Created at</p>
									<div className="flex flex-row items-center gap-2 mt-1">
										<Clock4Icon className="w-4 h-4 text-muted-foreground" />
										<p className="text-muted-foreground">
											{format(customer.createdAt, "MMM d, yyyy")}
										</p>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</Page>
	);
}
