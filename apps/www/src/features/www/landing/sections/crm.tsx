import { LandingSection, ScaledMock, SectionHeader } from "../shared";

/** Renders the CRM product section. */
export function LandingCrm() {
  return (
    <LandingSection id="crm">
      <div className="flex flex-col items-start justify-center gap-12 px-6 py-16 md:gap-23 md:px-12 md:py-24 xl:p-32">
        <SectionHeader
          description="See each customer's journey in one place, from their first visit to purchases, renewals and refunds, even when they switch devices."
          eyebrow="CRM"
          title="Know the people behind your growth."
        />
        <ScaledMock compactDesignWidth={1010} designWidth={1400}>
          {/* Below xl the detail card stops floating over the table and stacks above it, so the
              two panels become an ordinary flex column instead of the artboard's overlap. */}
          <div className="w-full xl:w-350 xl:h-125 mt-6 shrink-0 relative flex flex-col gap-10 xl:block">
          <div className="xl:left-97.5 xl:top-0 w-full xl:w-252.5 flex flex-col items-start rounded-lg overflow-clip relative xl:absolute">
            <div className="self-stretch flex items-center py-3.5 px-6 gap-4 border-b border-b-solid [border-bottom-color:var(--color-zinc-900)]">
              <div className="w-75 shrink-0 font-sans text-zinc-400 text-xs/4">
                Person
              </div>
              <div className="w-40 shrink-0 font-sans text-zinc-400 text-xs/4">
                Product
              </div>
              <div className="w-30 shrink-0 font-sans text-zinc-400 text-xs/4">
                Status
              </div>
              <div className="w-25 shrink-0 text-right font-sans flex justify-end flex-wrap text-zinc-400 text-xs/4">
                LTV
              </div>
              <div className="grow basis-[0%] text-right font-sans flex justify-end flex-wrap text-zinc-400 text-xs/4">
                Last seen
              </div>
            </div>
            <div className="self-stretch flex items-center py-3.75 px-6 gap-4 border-b border-b-solid [border-bottom-color:var(--color-zinc-900)]">
              <div className="w-75 shrink-0 flex items-center gap-3">
                <div className="w-7.5 h-7.5 shrink-0 rounded-[999px]" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(85.7% 0.018 0.147) 0%, oklab(88% -0.200 0.140) 100%)' }} />
                <div className="flex flex-col gap-0.5">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Mara Keller
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-500 text-xs/4">
                    mara.keller@hey.com
                  </div>
                </div>
              </div>
              <div className="w-40 shrink-0 font-sans text-[#FFFFFFB8] text-[13px]/4">
                Pro Annual
              </div>
              <div className="w-30 shrink-0 flex">
                <div className="flex items-center py-1 px-2.5 rounded-[999px] gap-1.5 bg-[#14532D33] border border-solid border-[#16653D]">
                  <div className="font-sans font-medium [color:var(--color-pistachio-600)] text-xs/4">
                    Active
                  </div>
                </div>
              </div>
              <div className="w-25 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-[13px]/4">
                $149.97
              </div>
              <div className="grow basis-[0%] text-right font-sans flex justify-end flex-wrap text-zinc-400 text-[13px]/4">
                2 min ago
              </div>
            </div>
            <div className="self-stretch flex items-center py-3.75 px-6 gap-4 border-b border-b-solid [border-bottom-color:var(--color-zinc-900)]">
              <div className="w-75 shrink-0 flex items-center gap-3">
                <div className="w-7.5 h-7.5 shrink-0 rounded-[999px]" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(87.3% -0.210 0.125) 0%, oklab(46.2% -0.031 -0.305) 100%)' }} />
                <div className="flex flex-col gap-0.5">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Jonas Ortega
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-500 text-xs/4">
                    j.ortega@fastmail.com
                  </div>
                </div>
              </div>
              <div className="w-40 shrink-0 font-sans text-[#FFFFFFB8] text-[13px]/4">
                Pro Monthly
              </div>
              <div className="w-30 shrink-0 flex">
                <div className="flex items-center py-1 px-2.5 rounded-[999px] gap-1.5 bg-[#1E3A8A40] border border-solid border-blue-ribbon-800">
                  <div className="font-sans font-medium text-blue-ribbon-400 text-xs/4">
                    In trial
                  </div>
                </div>
              </div>
              <div className="w-25 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-[13px]/4">
                $0.00
              </div>
              <div className="grow basis-[0%] text-right font-sans flex justify-end flex-wrap text-zinc-400 text-[13px]/4">
                18 min ago
              </div>
            </div>
            <div className="self-stretch flex items-center py-3.75 px-6 gap-4 relative bg-[#FFFFFF0A] border-b border-b-solid [border-bottom-color:var(--color-zinc-900)]">
              <div className="w-75 shrink-0 flex items-center gap-3">
                <div className="w-7.5 h-7.5 shrink-0 rounded-[999px]" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(68.1% -0.134 0.027) 0%, oklab(36.1% 0.011 -0.231) 100%)' }} />
                <div className="flex flex-col gap-0.5">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Amara Lindqvist
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-500 text-xs/4">
                    amara@lindqvist.se
                  </div>
                </div>
              </div>
              <div className="w-40 shrink-0 font-sans text-[#FFFFFFB8] text-[13px]/4">
                Pro Annual
              </div>
              <div className="w-30 shrink-0 flex">
                <div className="flex items-center py-1 px-2.5 rounded-[999px] gap-1.5 bg-[#14532D33] border border-solid border-[#16653D]">
                  <div className="font-sans font-medium [color:var(--color-pistachio-600)] text-xs/4">
                    Active
                  </div>
                </div>
              </div>
              <div className="w-25 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-[13px]/4">
                $299.94
              </div>
              <div className="grow basis-[0%] text-right font-sans flex justify-end flex-wrap text-zinc-400 text-[13px]/4">
                1 hr ago
              </div>
              <div className="absolute left-0 top-0 w-0.5 h-16.75" style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(68.1% -0.134 0.027) 0%, oklab(36.1% 0.011 -0.231) 100%)' }} />
            </div>
            <div className="self-stretch flex items-center py-3.75 px-6 gap-4 border-b border-b-solid [border-bottom-color:var(--color-zinc-900)]">
              <div className="w-75 shrink-0 flex items-center gap-3">
                <div className="w-7.5 h-7.5 shrink-0 rounded-[999px]" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(48.1% -0.041 -0.151) 0%, oklab(51.9% 0.198 -0.141) 100%)' }} />
                <div className="flex flex-col gap-0.5">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Diego Tran
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-500 text-xs/4">
                    dtran@proton.me
                  </div>
                </div>
              </div>
              <div className="w-40 shrink-0 font-sans text-[#FFFFFFB8] text-[13px]/4">
                Pro Monthly
              </div>
              <div className="w-30 shrink-0 flex">
                <div className="flex items-center py-1 px-2.5 rounded-[999px] gap-1.5 bg-[#78350F40] border border-solid border-[#A16207]">
                  <div className="font-sans font-medium text-[#FBBF24] text-xs/4">
                    Grace period
                  </div>
                </div>
              </div>
              <div className="w-25 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-[13px]/4">
                $59.88
              </div>
              <div className="grow basis-[0%] text-right font-sans flex justify-end flex-wrap text-zinc-400 text-[13px]/4">
                4 hrs ago
              </div>
            </div>
            <div className="self-stretch flex items-center py-3.75 px-6 gap-4 border-b border-b-solid [border-bottom-color:var(--color-zinc-900)]">
              <div className="w-75 shrink-0 flex items-center gap-3">
                <div className="w-7.5 h-7.5 shrink-0 rounded-[999px]" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(63.1% 0.235 0.099) 0%, oklab(92.5% -0.134 0.190) 100%)' }} />
                <div className="flex flex-col gap-0.5">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Sofia Baumann
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-500 text-xs/4">
                    sofia.b@icloud.com
                  </div>
                </div>
              </div>
              <div className="w-40 shrink-0 font-sans text-[#FFFFFFB8] text-[13px]/4">
                Lifetime
              </div>
              <div className="w-30 shrink-0 flex">
                <div className="flex items-center py-1 px-2.5 rounded-[999px] gap-1.5 bg-[#14532D33] border border-solid border-[#16653D]">
                  <div className="font-sans font-medium [color:var(--color-pistachio-600)] text-xs/4">
                    Active
                  </div>
                </div>
              </div>
              <div className="w-25 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-[13px]/4">
                $199.00
              </div>
              <div className="grow basis-[0%] text-right font-sans flex justify-end flex-wrap text-zinc-400 text-[13px]/4">
                Yesterday
              </div>
            </div>
            <div className="self-stretch flex items-center py-3.75 px-6 gap-4">
              <div className="w-75 shrink-0 flex items-center gap-3">
                <div className="w-7.5 h-7.5 shrink-0 rounded-[999px]" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(54.9% -0.036 -0.247) 0%, oklab(69% 0.276 -0.140) 100%)' }} />
                <div className="flex flex-col gap-0.5">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Ravi Nandakumar
                  </div>
                  <div className="tracking-[-0.01em] font-sans text-zinc-500 text-xs/4">
                    ravi.n@gmail.com
                  </div>
                </div>
              </div>
              <div className="w-40 shrink-0 font-sans text-[#FFFFFFB8] text-[13px]/4">
                Pro Annual
              </div>
              <div className="w-30 shrink-0 flex">
                <div className="flex items-center py-1 px-2.5 rounded-[999px] gap-1.5 border border-solid border-zinc-700">
                  <div className="font-sans font-medium text-zinc-400 text-xs/4">
                    Churned
                  </div>
                </div>
              </div>
              <div className="w-25 shrink-0 text-right font-sans font-medium flex justify-end flex-wrap text-white text-[13px]/4">
                $49.99
              </div>
              <div className="grow basis-[0%] text-right font-sans flex justify-end flex-wrap text-zinc-400 text-[13px]/4">
                6 days ago
              </div>
            </div>
            {/* Blends the table under the floating detail card — its focal point sits where the
                card overlaps, so it only makes sense while the two are stacked in z, not in flow. */}
            <div className="hidden xl:block absolute top-px -bottom-2 inset-x-px" style={{ backgroundImage: 'radial-gradient(ellipse 67.23% 100% at 21.92% 0% in oklab, oklab(17.1% 0 0 / 0%) 17.44%, oklab(16.1% .0004 -0.001 / 33.8%) 45.31%, oklab(14.1% 0.001 -0.004) 100%)' }} />
            {/* Mobile keeps just the bottom fade, so the row list still reads as continuing. */}
            <div className="xl:hidden absolute top-px -bottom-2 inset-x-px" style={{ backgroundImage: 'linear-gradient(to bottom, oklab(17.1% 0 0 / 0%) 55%, oklab(14.1% 0.001 -0.004) 100%)' }} />
          </div>
          <div className="relative xl:absolute -order-1 xl:order-none xl:left-0 xl:-top-6 w-full xl:w-126 flex flex-col items-start rounded-2xl overflow-clip [box-shadow:#000000B8_0px_28px_90px] bg-origin-border border border-solid [border-color:var(--color-zinc-800)]" style={{ backgroundImage: 'radial-gradient(ellipse 87.36% 97.41499999999999% at 100% 0% in oklab, var(--color-zinc-900) 0%, var(--color-zinc-950) 100%)' }}>
            <div className="self-stretch flex items-center pt-6 pb-4 overflow-clip gap-4.5 px-7">
              <div className="shrink-0 rounded-[999px] size-14" style={{ backgroundImage: 'linear-gradient(in oklab 135deg, oklab(68.1% -0.134 0.027) 0%, oklab(36.1% 0.011 -0.231) 100%)' }} />
              <div className="flex flex-col grow basis-[0%] gap-1">
                <div className="flex items-center gap-2.5">
                  <div className="tracking-[-0.03em] font-sans font-semibold text-white text-xl/relaxed">
                    Amara Lindqvist
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-sans text-zinc-400 text-[13px]/4.25">
                    Stockholm, Sweden
                  </div>
                  <div className="w-0.75 h-0.75 shrink-0 rounded-[999px] bg-zinc-700" />
                  <div className="font-sans text-zinc-400 text-[13px]/4.25">
                    iPhone 16 Pro · iOS 18.4
                  </div>
                </div>
              </div>
            </div>
            <div className="self-stretch flex">
              <div className="flex flex-col w-40.25 shrink-0 py-4 px-7">
                <div className="font-sans text-zinc-400 text-[13px]/4">
                  Lifetime value
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="tracking-[-0.035em] font-sans font-semibold text-white text-xl/8">
                    $299.94
                  </div>
                </div>
              </div>
              <div className="flex flex-col grow basis-[0%] py-4 px-6">
                <div className="font-sans text-zinc-400 text-[13px]/4">
                  Subscribed
                </div>
                <div className="tracking-[-0.02em] font-sans font-medium text-white text-xl/8">
                  3 yrs
                </div>
              </div>
              <div className="flex flex-col grow basis-[0%] items-end py-4 px-6">
                <div className="self-stretch text-right font-sans flex justify-end flex-wrap text-zinc-400 text-[13px]/4">
                  Renews
                </div>
                <div className="tracking-[-0.02em] self-stretch text-right font-sans font-medium flex justify-end flex-wrap text-white text-xl/8">
                  Mar 4
                </div>
              </div>
            </div>
            <div className="self-stretch flex flex-col pb-6 gap-4.5 pt-4 relative px-7">
              <div className="absolute left-8 top-16 w-px h-41.25" style={{ backgroundImage: 'linear-gradient(in oklab 180deg, oklab(37% 0.003 -0.011) 0%, oklab(27.4% 0.002 -0.005) 70%, oklab(27.4% 0.002 -0.005 / 0%) 100%)' }} />
              <div className="flex items-center gap-3 justify-between relative">
                <div className="shrink-0 [letter-spacing:var(--tracking-normal)] font-sans font-medium [color:var(--color-white)] text-base/3.5">
                  Activity
                </div>
                <div className="shrink-0 font-sans text-zinc-400 text-xs/3.5">
                  Since Feb 2023
                </div>
              </div>
              <div className="flex items-start gap-4 relative">
                <div className="w-2.25 h-2.25 mt-1.25 shrink-0 rounded-[999px] [background-color:var(--color-pistachio-600)]" />
                <div className="flex flex-col grow basis-[0%] gap-0.75">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Renewed Pro Annual
                  </div>
                  <div className="font-sans text-zinc-400 text-xs/4">
                    App Store · Mar 4, 2026
                  </div>
                </div>
                <div className="shrink-0 mt-px font-sans font-medium [color:var(--color-pistachio-600)] text-sm/4.5">
                  +$99.99
                </div>
              </div>
              <div className="flex items-start gap-4 relative">
                <div className="w-2.25 h-2.25 mt-1.25 shrink-0 rounded-[999px] [background-color:var(--color-blue-ribbon-500)]" />
                <div className="flex flex-col grow basis-[0%] gap-0.75">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Saw paywall · Onboarding, Variant C
                  </div>
                  <div className="font-sans text-zinc-400 text-xs/4">
                    iOS app · Mar 2, 2026
                  </div>
                </div>
                <div className="shrink-0 mt-px font-sans font-medium text-blue-ribbon-400 text-[13px]/4.5">
                  Converted
                </div>
              </div>
              <div className="flex items-start gap-4 relative">
                <div className="w-2.25 h-2.25 mt-1.25 shrink-0 rounded-[999px] bg-electric-violet-400" />
                <div className="flex flex-col grow basis-[0%] gap-0.75">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Switched Monthly → Annual
                  </div>
                  <div className="font-sans text-zinc-400 text-xs/4">
                    App Store · Nov 18, 2025
                  </div>
                </div>
                <div className="shrink-0 mt-px font-sans font-medium [color:var(--color-pistachio-600)] text-sm/4.5">
                  +$39.99
                </div>
              </div>
              <div className="flex items-start gap-4 relative">
                <div className="w-2.25 h-2.25 mt-1.25 shrink-0 rounded-[999px] bg-zinc-600" />
                <div className="flex flex-col grow basis-[0%] gap-0.75">
                  <div className="tracking-[-0.02em] font-sans font-medium text-white text-sm/4.5">
                    Started 7-day free trial
                  </div>
                  <div className="font-sans text-zinc-400 text-xs/4">
                    App Store · Feb 26, 2023
                  </div>
                </div>
                <div className="shrink-0 mt-px font-sans text-zinc-400 text-[13px]/4.5">
                  First touch
                </div>
              </div>
            </div>
          </div>
          </div>
        </ScaledMock>
      </div>
    </LandingSection>
  );
}
