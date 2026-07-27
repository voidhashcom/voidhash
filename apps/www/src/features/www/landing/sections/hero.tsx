import { Button } from "@voidhash/ui";
import { ChevronRightIcon } from "lucide-react";

import { HeroShader } from "@/features/www/hero/hero-shader";
import { signUpCtaLabel } from "@/lib/waitlist";

import { LandingSection } from "../shared";

/** Renders the landing page hero, backed by the lenticular gradient shader. */
export function LandingHero() {
  return (
    <LandingSection>
      <div className="relative flex flex-col items-center overflow-clip px-6 py-24 md:py-40 xl:py-56">
        <div className="absolute inset-0">
          <HeroShader />
        </div>
        <div className="relative flex w-full max-w-[826px] flex-col items-center gap-8 md:gap-11.5">
          <div className="flex items-center justify-center rounded-[23px] bg-zinc-900 px-4 py-1.75 [outline:1px_solid_var(--zinc-800)] -outline-offset-1">
            <div className="font-sans font-semibold text-zinc-400 text-sm/normal tracking-[-0.03em]">
              Currently available in Alpha preview
            </div>
          </div>
          <div className="flex flex-col items-center gap-10 md:gap-12">
            <div className="flex flex-col items-center gap-6">
              <h1 className="text-balance text-center font-medium font-sans text-[40px] text-white leading-[110%] tracking-[-0.03em] md:text-[56px] xl:text-[64px]">
                The AI-native growth platform for mobile apps
              </h1>
              <p className="max-w-[628px] text-center font-sans text-zinc-400 text-base/6.5 tracking-[-0.03em] md:text-xl/8">
                Build paywalls, manage customers, analyze data, A/B test and much more – all in a
                single integrated platform.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="/auth/sign-up">
                  {signUpCtaLabel("Get Started")}
                  <ChevronRightIcon data-icon="inline-end" />
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href="/docs">
                  Documentation
                  <ChevronRightIcon data-icon="inline-end" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
