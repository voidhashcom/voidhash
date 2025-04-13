import { SettingsCardSkeleton } from "@voidhash/ui";
import { SettingsGeneralLayout } from "./settings-general-layout";

export function SettingsGeneralPageSkeleton() {
	return (
		<SettingsGeneralLayout>
			<SettingsCardSkeleton content={true} />
			<SettingsCardSkeleton
				description={false}
				content={false}
				instructions={false}
				action={false}
			/>
		</SettingsGeneralLayout>
	);
}
