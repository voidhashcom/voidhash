import { SettingsCardSkeleton } from "@voidhash/ui";

import { ProjectSettingsGeneralLayout } from "./project-settings-general-layout";

export function ProjectSettingsGeneralPageSkeleton() {
  return (
    <ProjectSettingsGeneralLayout>
      <SettingsCardSkeleton content={true} />
      <SettingsCardSkeleton
        action={false}
        content={false}
        description={false}
        instructions={false}
      />
    </ProjectSettingsGeneralLayout>
  );
}
