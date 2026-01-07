import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@voidhash/ui";
import { useAuth } from "src/components/auth-context";

import { ApiKeyRecord } from "@/features/api-keys/api-key-record";
import { ApiKeyRecordSkeleton } from "@/features/api-keys/api-key-record-skeleton";
import { CreateSecretKeyModalButton } from "@/features/api-keys/create-secret-key-modal-button";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { listApiKeysOptions } from "@/lib/tanstack-query";
import { CurrentUser } from "@/lib/utils/current-user";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/developers/api-keys"
)({
  component: ProjectApiKeysPage,
  errorComponent: ProjectApiKeysPageError,
  pendingComponent: ProjectApiKeysPageSkeleton,
});

export function ProjectApiKeysPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occured loading the api keys",
      }}
    />
  );
}

export function ProjectApiKeysPageSkeleton() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">API Keys</h2>
          <p className="mt-1 text-muted-foreground">Manage your API keys</p>
        </div>
      </div>

      <div className="mt-8">
        <Card className="grid gap-0 divide-y p-0">
          {Array.from({ length: 3 }).map((_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: just a skeleton
            <ApiKeyRecordSkeleton key={index} />
          ))}
        </Card>
      </div>
    </div>
  );
}

export function ProjectApiKeysPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: apiKeys } = useSuspenseQuery(
    listApiKeysOptions({ projectId: project.id })
  );

  return (
    <div>
      <div className="flex flex-row items-center justify-between pt-6">
        <div>
          <h2 className="font-normal text-xl tracking-right">API Keys</h2>
          <p className="mt-1 text-muted-foreground">Manage your API keys</p>
        </div>
        <CreateSecretKeyModalButton projectId={project.id} />
      </div>

      <div className="mt-8">
        <Card className="grid gap-0 divide-y p-0">
          {apiKeys.map((apiKey) => (
            <ApiKeyRecord apiKey={apiKey} key={apiKey.id} />
          ))}
        </Card>
      </div>
    </div>
  );
}
