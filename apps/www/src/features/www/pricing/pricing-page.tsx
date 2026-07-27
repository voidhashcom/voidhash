"use client";

import { LandingDivider } from "@/features/www/landing/sections/divider";
import { LandingFooter } from "@/features/www/landing/sections/footer";
import { LandingGetStarted } from "@/features/www/landing/sections/get-started";
import { LandingNavbar } from "@/features/www/landing/sections/navbar";

import { PricingCalculator } from "./sections/calculator";
import { PricingFaq } from "./sections/faq";
import { PricingHero } from "./sections/hero";
import { PricingMatrix } from "./sections/matrix";
import { PricingPlans } from "./sections/plans";

/** Renders the Voidhash pricing page. */
export function PricingPage() {
  return (
    <div className="dark w-full overflow-x-clip bg-zinc-950 text-xs/4 antialiased [font-synthesis:none]">
      <LandingNavbar />
      <div className="flex w-full flex-col items-start gap-px">
        <PricingHero />
        <PricingPlans />
        <LandingDivider />
        <PricingCalculator />
        <LandingDivider />
        <PricingMatrix />
        <LandingDivider />
        <PricingFaq />
        <LandingDivider />
        <LandingGetStarted />
        <LandingDivider />
        <LandingFooter />
      </div>
    </div>
  );
}
