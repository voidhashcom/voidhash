import { getUser } from "@/lib/services/users/queries";
import { redirect } from "next/navigation";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export default async function Index() {
	const user = await getUser({
		ctx: await createNextServiceContext(),
	});

	if (user) {
		if (user.organizations.length === 0) {
			return redirect("/~/create-organization");
		}
		return redirect(`/${user.organizations[0]!.slug}`);
	}

	return redirect("/login");
}
