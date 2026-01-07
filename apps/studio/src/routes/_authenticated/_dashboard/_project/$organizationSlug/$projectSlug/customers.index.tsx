import { createFileRoute } from "@tanstack/react-router";
import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "@voidhash/ui";
import { useAuth } from "src/components/auth-context";

import { CreateCustomerButton } from "@/features/customers/create-customer-button";
import { CustomersTable } from "@/features/customers/customers-table";
import { Page } from "@/features/shell";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { CurrentUser } from "@/lib/utils/current-user";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/customers/"
)({
  component: CustomersIndexPage,
});

function CustomersIndexPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  if (!project) {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "The project you are looking for does not exist.",
          title: "Project not found",
        }}
      />
    );
  }

  return (
    <Page className="p-0 py-8">
      <div className="mx-auto flex max-w-4xl flex-row items-center justify-between">
        <h1 className="font-normal text-3xl tracking-right">Customers</h1>
        <CreateCustomerButton projectId={project.id} />
      </div>

      <div className="mt-3">
        <UnderlineTabs defaultValue="identified">
          <UnderlineTabsList>
            <div className="mx-auto inline-flex w-full max-w-4xl items-center space-x-4 rounded-none">
              <UnderlineTabsTrigger value="identified">
                Identified
              </UnderlineTabsTrigger>
              <UnderlineTabsTrigger value="anonymous">
                <span>Anonymous</span>
              </UnderlineTabsTrigger>
            </div>
          </UnderlineTabsList>
          <UnderlineTabsContent value="identified">
            <div className="mx-auto max-w-4xl">
              <CustomersTable
                organizationSlug={organizationSlug as string}
                projectId={project.id}
                projectSlug={projectSlug as string}
                type={1} // TODO: Use CustomerType
              />
            </div>
          </UnderlineTabsContent>
          <UnderlineTabsContent value="anonymous">
            <div className="mx-auto max-w-4xl">
              <CustomersTable
                organizationSlug={organizationSlug as string}
                projectId={project.id}
                projectSlug={projectSlug as string}
                type={2} // TODO: Use CustomerType
              />
            </div>
          </UnderlineTabsContent>
        </UnderlineTabs>
      </div>
    </Page>
  );
}
