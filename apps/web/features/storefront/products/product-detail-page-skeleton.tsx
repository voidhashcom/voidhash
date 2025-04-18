import { Page } from "@/features/shell";
import { Card } from "@voidhash/ui";
import { ProductRecordSkeleton } from "./product-record-skeleton";

export function ProductsDetailPageSkeleton() {
	return (
		<Page
			breadcrumbs={[
				{
					title: "Products",
				},
				{
					title: "Product",
					isLoading: true,
				},
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Products</h1>
				</div>
				<p className="text-muted-foreground mt-3">TODO: Brainstorm</p>
				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						{Array.from({ length: 5 }).map((_, index) => (
							<ProductRecordSkeleton key={index} />
						))}
					</Card>
				</div>
			</div>
		</Page>
	);
}
