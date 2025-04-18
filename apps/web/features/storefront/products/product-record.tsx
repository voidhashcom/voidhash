"use client";
import { getProducts } from "@/lib/services/products/queries";

export function ProductRecord({
	product,
}: {
	product: NonNullable<Awaited<ReturnType<typeof getProducts>>>[number];
}) {
	return (
		<div className="relative isolate group hover:bg-accent/30 px-6 py-4">
			<div className="flex flex-row items-center justify-between">
				<div className="flex items-start gap-4 flex-1">
					<div>{product.name}</div>
				</div>
				<div className="flex items-center gap-2">
					{/* <DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" className="z-20">
								<EllipsisVerticalIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="w-48" align="end">
							<DropdownMenuItem
								className="cursor-pointer"
								disabled={isDeleting}
								onClick={handleDeleteKey}
							>
								Delete product
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu> */}
				</div>
			</div>
		</div>
	);
}
