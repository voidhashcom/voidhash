import { Button, Switch } from "@voidhash/ui";

import { CountUp, GrowBar, Illustration } from "../motion";
import { LandingSection, ScaledMock, SectionHeader } from "../shared";

/** Renders the experimentation product section. */
export function LandingExperimentation() {
  return (
    <LandingSection id="experimentation">
      <div className="flex flex-col items-start justify-center gap-12 px-6 py-16 md:gap-23 md:px-12 md:py-24 xl:p-32">
        <SectionHeader
          description="Paywall A/B tests and feature flags share one targeting engine — so an experiment is just a flag with results attached."
          eyebrow="Experimentation"
          title="Test every price, every screen, every rollout."
        />
        <div className="flex flex-col items-start gap-6 self-stretch xl:flex-row">
          <ScaledMock className="min-w-0 flex-1" designWidth={944}>
            <Illustration className="w-236 flex flex-col items-start rounded-lg overflow-clip relative shrink-0">
              <div className="self-stretch flex items-center justify-between py-5 px-6">
                <div className="flex flex-col gap-2">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-[15px]/4.5">
                    Onboarding paywall — annual price
                  </div>
                  <div className="font-sans text-zinc-400 text-xs/4">
                    Running · 14 days · 48,204 exposures
                  </div>
                </div>
              </div>
              <div className="self-stretch flex flex-col py-6.5 px-6 gap-5.5 grow items-start">
                <div className="flex items-center gap-5 self-stretch">
                  <div className="w-50 shrink-0 font-sans text-zinc-400 text-xs/4">
                    Variant
                  </div>
                  <div className="grow basis-[0%] font-sans text-zinc-400 text-xs/4">
                    Trial start rate
                  </div>
                  <div className="w-24 shrink-0 text-right font-sans flex justify-end flex-wrap text-zinc-400 text-xs/4">
                    ARPU
                  </div>
                  <div className="w-21 shrink-0 text-right font-sans flex justify-end flex-wrap text-zinc-400 text-xs/4">
                    Lift
                  </div>
                </div>
                <div className="flex items-center gap-5 self-stretch">
                  <div className="w-50 shrink-0 flex flex-col gap-0.75">
                    <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                      Control
                    </div>
                    <div className="tracking-[-0.01em] font-sans text-zinc-400 text-[13px]/4">
                      $49.99 / year · 33%
                    </div>
                  </div>
                  <div className="grow basis-[0%] flex items-center gap-3">
                    <GrowBar className="h-6.5 w-56 shrink-0 rounded-lg [background-color:var(--color-zinc-800)]" />
                    <div className="font-sans font-medium text-[#FFFFFFB8] text-sm/4.5">
                      <CountUp value="21.4%" />
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-sm/4.5">
                    <CountUp value="$1.62" />
                  </div>
                  <div className="w-21 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-zinc-500 text-sm/4.5">
                    —
                  </div>
                </div>
                <div className="flex items-center gap-5 self-stretch">
                  <div className="w-50 shrink-0 flex flex-col gap-0.75">
                    <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                      Variant B
                    </div>
                    <div className="tracking-[-0.01em] font-sans text-zinc-400 text-[13px]/4">
                      $59.99 / year · 33%
                    </div>
                  </div>
                  <div className="grow basis-[0%] flex items-center gap-3">
                    <GrowBar className="h-6.5 w-51.75 shrink-0 rounded-lg [background-color:var(--color-zinc-800)]" delay={0.08} />
                    <div className="font-sans font-medium text-[#FFFFFFB8] text-sm/4.5">
                      <CountUp delay={0.08} value="19.8%" />
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-sm/4.5">
                    <CountUp delay={0.08} value="$1.71" />
                  </div>
                  <div className="w-21 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap [color:var(--color-pistachio-600)] text-sm/4.5">
                    <CountUp delay={0.08} value="+5.6%" />
                  </div>
                </div>
                <div className="flex items-center gap-5 self-stretch">
                  <div className="w-50 shrink-0 flex flex-col gap-0.75">
                    <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                      Variant C
                    </div>
                    <div className="tracking-[-0.01em] font-sans text-zinc-400 text-[13px]/4">
                      $39.99 / year + 7d trial · 34%
                    </div>
                  </div>
                  <div className="grow basis-[0%] flex items-center gap-3">
                    <GrowBar className="h-6.5 w-73 shrink-0 rounded-lg [box-shadow:var(--color-blue-ribbon-300)_0px_0px_6px_inset] [background-color:var(--color-blue-ribbon-600)]" delay={0.16} />
                    <div className="font-sans font-medium text-white text-sm/4.5">
                      <CountUp delay={0.16} value="27.9%" />
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-sm/4.5">
                    <CountUp delay={0.16} value="$2.04" />
                  </div>
                  <div className="w-21 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap [color:var(--color-pistachio-600)] text-sm/4.5">
                    <CountUp delay={0.16} value="+25.9%" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-6.5 px-6 rounded-lg overflow-clip gap-12 w-236 [background-color:var(--color-zinc-950)]">
                <div className="w-179 flex flex-col gap-2.25 shrink-0">
                  <div className="self-stretch h-6.5 flex rounded-lg shrink-0 [background-color:var(--color-zinc-800)]">
                    <GrowBar className="w-55.75 rounded-lg shrink-0 [box-shadow:var(--color-blue-ribbon-300)_0px_0px_6px_inset] [background-color:var(--color-blue-ribbon-600)]" delay={0.24} />
                  </div>
                  <div className="self-stretch flex items-center justify-between">
                    <div className="font-sans text-zinc-400 text-xs/4">
                      Rollout <CountUp delay={0.24} value="34%" />
                    </div>
                    <div className="font-sans text-zinc-400 text-xs/4">
                      Target 100%
                    </div>
                  </div>
                </div>
                <Button className="relative shrink-0">Ship Variant C</Button>
              </div>
              <div className="absolute top-0 -bottom-2.25 inset-x-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse 114.14500000000001% 169.79% at 37.84% 1.6199999999999992% in oklab, oklab(17.1% 0 0 / 0%) 17.64%, oklab(14.1% 0.001 -0.004) 100%)' }} />
            </Illustration>
          </ScaledMock>
          <div className="w-full max-w-107.25 flex flex-col items-start rounded-lg overflow-clip shrink-0 bg-origin-border border border-solid [border-color:var(--color-zinc-800)]" style={{ backgroundImage: 'radial-gradient(ellipse 100.22999999999999% 100% at 0% 0% in oklab, var(--color-zinc-900) 0%, var(--color-zinc-950) 100%)' }}>
              <div className="self-stretch flex items-center justify-between py-5 px-6 border-b border-b-solid [border-bottom-color:var(--color-zinc-800)]">
                <div className="tracking-[-0.02em] font-sans font-medium text-white text-[15px]/4.5">
                  Feature flags
                </div>
                <div className="font-sans text-zinc-400 text-xs/4">
                  Production
                </div>
              </div>
              <div className="self-stretch flex items-center py-4.5 px-6 gap-4 border-b border-b-solid border-b-zinc-900">
                <div className="grow basis-[0%] flex flex-col gap-1">
                  <div className="font-mono font-medium text-white text-[13px]/4">
                    new_onboarding_flow
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-400 text-xs/4">
                    iOS · 25% rollout
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="self-stretch flex items-center py-4.5 px-6 gap-4 border-b border-b-solid border-b-zinc-900">
                <div className="grow basis-[0%] flex flex-col gap-1">
                  <div className="font-mono font-medium text-white text-[13px]/4">
                    annual_price_test
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-400 text-xs/4">
                    Backing flag · experiment · 100%
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="self-stretch flex items-center py-4.5 px-6 gap-4 border-b border-b-solid border-b-zinc-900">
                <div className="grow basis-[0%] flex flex-col gap-1">
                  <div className="font-mono font-medium text-white text-[13px]/4">
                    winback_offer_v2
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-400 text-xs/4">
                    Churned subscribers · 50% rollout
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="self-stretch flex items-center py-4.5 px-6 gap-4 border-b border-b-solid border-b-zinc-900">
                <div className="grow basis-[0%] flex flex-col gap-1">
                  <div className="font-mono font-medium text-zinc-400 text-[13px]/4">
                    family_sharing
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-400 text-xs/4">
                    Internal testers only · off
                  </div>
                </div>
                <Switch />
              </div>
              <div className="self-stretch flex items-center py-4.5 px-6 gap-4">
                <div className="grow basis-[0%] flex flex-col gap-1">
                  <div className="font-mono font-medium text-zinc-400 text-[13px]/4">
                    paywall_v4_layout
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-400 text-xs/4">
                    All platforms · draft
                  </div>
                </div>
                <Switch />
              </div>
            </div>
        </div>
      </div>
    </LandingSection>
  );
}
