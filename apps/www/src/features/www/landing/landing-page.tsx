"use client";

import { LandingAnalytics } from "./sections/analytics";
import { LandingAsteroids } from "./sections/asteroids";
import { LandingCrm } from "./sections/crm";
import { LandingDevelopers } from "./sections/developers";
import { LandingDivider } from "./sections/divider";
import { LandingExperimentation } from "./sections/experimentation";
import { LandingFooter } from "./sections/footer";
import { LandingGetStarted } from "./sections/get-started";
import { LandingHero } from "./sections/hero";
import { LandingNavbar } from "./sections/navbar";
import { LandingPaywalls } from "./sections/paywalls";
import { LandingProblem } from "./sections/problem";

/** Renders the Voidhash marketing landing page. */
export function LandingPage() {
  return (
    <div className="dark w-full overflow-x-clip bg-zinc-950 text-xs/4 antialiased [font-synthesis:none]">
      <LandingNavbar />
      <div className="flex w-full flex-col items-start gap-px">
        <LandingHero />
        <LandingDivider />
        <LandingProblem />
        <LandingDivider />
        <LandingPaywalls />
        <LandingDivider />
        <LandingAnalytics />
        <LandingDivider />
        <LandingExperimentation />
        <LandingDivider />
        <LandingCrm />
        <LandingDivider />
        <LandingDevelopers />
        <LandingDivider />
        <LandingGetStarted />
        <LandingDivider />
        <LandingFooter />
        <LandingDivider />
        <LandingAsteroids />
      </div>
    </div>
  );
}
