import { redirect } from "next/navigation";

export default async function Dashboard({
	params,
}: { params: Promise<{ organizationSlug: string }> }) {
	const { organizationSlug } = await params;

	return redirect(`/~/${organizationSlug}/projects`);
}
