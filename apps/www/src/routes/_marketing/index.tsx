import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";

import { Footer } from "@/features/www/hero/footer";
import { Hero } from "@/features/www/hero/hero";
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
  return (
    <>
      <main className="flex w-full max-w-7xl flex-col md:mx-auto">
        <Hero />
      </main>
      <Footer />
    </>
  );
}
