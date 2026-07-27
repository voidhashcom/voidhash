import { Skeleton } from "@voidhash/ui";
import { SettingsCard, SettingsSection } from "@/features/studio/settings";

import { ProjectSettingsGeneralLayout } from "./project-settings-general-layout";

export function ProjectSettingsGeneralPageSkeleton() {
  return (
    <ProjectSettingsGeneralLayout>
      <SettingsSection title="Project">
        <SettingsCard>
          <div className="space-y-3 px-5 py-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-8 w-72" />
          </div>
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Danger zone">
        <SettingsCard variant="destructive">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
        </SettingsCard>
      </SettingsSection>
    </ProjectSettingsGeneralLayout>
  );
}
