import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "src/components/auth-context";

import { SettingsGeneralLayout } from "@/features/organizations/settings/general/settings-general-layout";
import { TeamDelete } from "@/features/organizations/settings/general/team-delete";
import { TeamNameForm } from "@/features/organizations/settings/general/team-name";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/_organization/$organizationSlug/~/settings/general"
)({
  component: SettingsGeneralPage,
});

export function SettingsGeneralPage() {
  const { organizationSlug } = Route.useParams();
  const { user } = useAuth();

  const activeOrganization = user.organizations.find(
    (organization) => organization.slug === organizationSlug
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
      <TeamNameForm
        key={organizationSlug as string}
        organization={activeOrganization}
      />
      <TeamDelete organizationId={activeOrganization.id} />
    </SettingsGeneralLayout>
  );
}
