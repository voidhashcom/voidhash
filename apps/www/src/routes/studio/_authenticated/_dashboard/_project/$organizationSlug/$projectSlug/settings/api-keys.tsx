import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/studio/components/auth-context";

import { ApiKeyRecord } from "@/features/studio/api-keys/api-key-record";
import { ApiKeyRecordSkeleton } from "@/features/studio/api-keys/api-key-record-skeleton";
import { CreateSecretKeyModalButton } from "@/features/studio/api-keys/create-secret-key-modal-button";
import { SettingsCard, SettingsPage } from "@/features/studio/settings";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { listApiKeysOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/api-keys",
)({
  component: ProjectApiKeysPage,
  errorComponent: ProjectApiKeysPageError,
  pendingComponent: ProjectApiKeysPageSkeleton,
});

function ProjectApiKeysPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occured loading the api keys",
      }}
    />
  );
}

function ProjectApiKeysPageSkeleton() {
  return (
    <SettingsPage description="Manage your API keys." title="API Keys">
      <SettingsCard className="grid gap-0 divide-y">
        {Array.from({ length: 3 }).map((_, index) => (
          <ApiKeyRecordSkeleton key={index} />
        ))}
      </SettingsCard>
    </SettingsPage>
  );
}

function ProjectApiKeysPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: apiKeys } = useSuspenseQuery(listApiKeysOptions({ projectId: project.id }));

  return (
    <SettingsPage
      actions={<CreateSecretKeyModalButton projectId={project.id} />}
      description="Manage your API keys."
      title="API Keys"
    >
      <SettingsCard className="grid gap-0 divide-y">
        {apiKeys.map((apiKey) => (
          <ApiKeyRecord apiKey={apiKey} key={apiKey.id} />
        ))}
      </SettingsCard>
    </SettingsPage>
  );
}
