import { SettingsCardSkeleton } from "@voidhash/ui";
import { ProjectSettingsGeneralLayout } from "./project-settings-general-layout";

export function ProjectSettingsGeneralPageSkeleton() {
	return (
		<ProjectSettingsGeneralLayout>
			<SettingsCardSkeleton content={true} />
			<SettingsCardSkeleton
				description={false}
				content={false}
				instructions={false}
				action={false}
			/>
		</ProjectSettingsGeneralLayout>
	);
}
