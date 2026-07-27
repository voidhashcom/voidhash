import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";

import { LandingPage } from "@/features/www/landing/landing-page";
import { STUDIO_PATH } from "@/lib/paths";

export const Route = createFileRoute("/_marketing/")({
  component: MarketingHome,
  loader: async () => {
    const auth = await getAuth();
    if (auth.user) {
      throw redirect({ to: STUDIO_PATH });
    }
  },
});

function MarketingHome() {
  return <LandingPage />;
}
