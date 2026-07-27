import { HeroShader } from "@/features/www/hero/hero-shader";
import { LandingSection } from "@/features/www/landing/shared";

/** Renders the pricing page hero, backed by the same lenticular shader as the landing hero. */
export function PricingHero() {
  return (
    <LandingSection>
      <div className="relative flex flex-col items-center overflow-clip px-6 py-24 md:py-32 xl:py-40">
        <div className="absolute inset-0">
          <HeroShader />
        </div>
        <div className="relative flex w-full max-w-[826px] flex-col items-center gap-6">
          <h1 className="text-balance text-center font-medium font-sans text-[40px] text-white leading-[110%] tracking-[-0.03em] md:text-[56px]">
            Pricing that starts at zero and scales with you
          </h1>
          <p className="max-w-[600px] text-center font-sans text-zinc-400 text-base/6.5 tracking-[-0.03em] md:text-xl/8">
            Every plan includes the whole platform. You only ever pay for the revenue we track and
            the events we ingest for you.
          </p>
        </div>
      </div>
    </LandingSection>
  );
}
