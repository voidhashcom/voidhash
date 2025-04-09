import { redirect } from "next/navigation";

export default function Dashboard({
	params,
}: { params: { organizationSlug: string } }) {
	return redirect(`/~/${params.organizationSlug}/projects`);
}
