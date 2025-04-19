import { Page } from "@/features/shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { notFound } from "next/navigation";
import { CustomersTable } from "./customers-table";
import { CreateCustomerButton } from "./create-customer-button";
export async function CustomersPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug;
}) {
	const serviceContext = await createNextServiceContext();
	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	if (!project) {
		return notFound();
	}

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Customers</h1>
					<CreateCustomerButton projectId={project.id} />
				</div>
				{/* <p className="text-muted-foreground mt-3">
					List of products available to purchase.
				</p> */}
				<div className="mt-8">
					<CustomersTable projectId={project.id} />
				</div>
			</div>
		</Page>
	);
}
