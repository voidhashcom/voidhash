import { getUser } from "@/lib/queries/cached-queries";
import { redirect } from "next/navigation";

export default async function Index() {
	const user = await getUser();

	if (user) {
		if (user.organizations.length === 0) {
			return redirect("/~/create-organization");
		}
		return redirect(`/${user.organizations[0]!.slug}`);
	}

	return redirect("/login");
}
