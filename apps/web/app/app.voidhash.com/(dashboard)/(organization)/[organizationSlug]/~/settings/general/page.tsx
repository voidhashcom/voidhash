import SettingsGeneralPage from "@/features/organizations/settings/general/settings-general-page";

export default async function Page({
	params,
}: { params: Promise<{ organizationSlug: string }> }) {
	const { organizationSlug } = await params;

	return <SettingsGeneralPage params={{ organizationSlug }} />;
}
