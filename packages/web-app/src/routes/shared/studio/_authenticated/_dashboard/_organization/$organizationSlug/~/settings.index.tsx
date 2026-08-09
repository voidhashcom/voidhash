import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/studio/components/auth-context";

import { SettingsGeneralLayout } from "@/features/studio/organizations/settings/general/settings-general-layout";
import { TeamAvatarForm } from "@/features/studio/organizations/settings/general/team-avatar";
import { TeamDelete } from "@/features/studio/organizations/settings/general/team-delete";
import { TeamNameForm } from "@/features/studio/organizations/settings/general/team-name";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_organization/$organizationSlug/~/settings/",
)({
  component: SettingsGeneralPage,
});

function SettingsGeneralPage() {
  const { organizationSlug } = Route.useParams();
  const { user } = useAuth();

  const activeOrganization = user.organizations.find(
    (organization) => organization.slug === organizationSlug,
  );
  if (!activeOrganization) {
    return (
      <VoidhashErrorCard
        error={{
          code: "NOT_FOUND",
          message: "Organization not found",
        }}
      />
    );
  }
  return (
    <SettingsGeneralLayout>
      <TeamAvatarForm key={organizationSlug as string} organization={activeOrganization} />
      <TeamNameForm key={`${organizationSlug}-name`} organization={activeOrganization} />
      <TeamDelete organizationId={activeOrganization.id} />
    </SettingsGeneralLayout>
  );
}
