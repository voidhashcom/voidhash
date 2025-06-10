import { Page } from "@/features/shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { CustomersTable } from "./customers-table";
import { CreateCustomerButton } from "./create-customer-button";
import {
	UnderlineTabs,
	UnderlineTabsContent,
	UnderlineTabsList,
	UnderlineTabsTrigger,
} from "@voidhash/ui";
import { VoidhashErrorCard } from "../shell/components/voidhash-error-card";
export async function CustomersPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug;
}) {
	const serviceContext = await createNextServiceContext();
	const projectResult = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	if (projectResult.isErr()) {
		const error = projectResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const project = projectResult.value;

	return (
		<Page className="p-0 py-8">
			{/* Key is used to reload the default form data when the organization slug changes */}

			<div className="flex flex-row items-center justify-between max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Customers</h1>
				<CreateCustomerButton projectId={project.id} />
			</div>
			{/* <p className="text-muted-foreground mt-3">
					List of products available to purchase.
				</p> */}

			<div className="mt-3">
				<UnderlineTabs defaultValue="identified">
					<UnderlineTabsList>
						<div className="max-w-4xl mx-auto w-full inline-flex items-center rounded-none space-x-4">
							<UnderlineTabsTrigger value="identified">
								Identified
							</UnderlineTabsTrigger>
							<UnderlineTabsTrigger value="anonymous">
								<span>Anonymous</span> {/* Number of unidentified customers */}
								{/* {!!10 && (
									<Badge
										variant="secondary"
										className="ml-2 px-1 py-0 text-xs rounded-full"
									>
										10
									</Badge>
								)} */}
							</UnderlineTabsTrigger>
						</div>
					</UnderlineTabsList>
					<UnderlineTabsContent value="identified">
						<div className="max-w-4xl mx-auto">
							<CustomersTable
								projectId={project.id}
								type="identified"
								organizationSlug={organizationSlug}
								projectSlug={projectSlug}
							/>
						</div>
					</UnderlineTabsContent>
					<UnderlineTabsContent value="anonymous">
						<div className="max-w-4xl mx-auto">
							<CustomersTable
								projectId={project.id}
								type="anonymous"
								organizationSlug={organizationSlug}
								projectSlug={projectSlug}
							/>
						</div>
					</UnderlineTabsContent>
				</UnderlineTabs>
			</div>
		</Page>
	);
}
