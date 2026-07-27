import { ChartWipe, CountUp, Illustration } from "../motion";
import { LandingSection, ScaledMock, SectionHeader } from "../shared";

/** Renders the analytics product section. */
export function LandingAnalytics() {
  return (
    <LandingSection id="analytics">
      <div className="flex flex-col items-start justify-center gap-12 px-6 py-16 md:gap-23 md:px-12 md:py-24 xl:p-32">
        <SectionHeader
          description="Installs, trials, conversion, retention and MRR — computed from the same subscription state that powers your app. No SDK gymnastics, no nightly exports."
          eyebrow="Analytics"
          title="Know exactly where your revenue comes from, and where it leaks."
        />
        <div className="flex flex-col items-start gap-10 self-stretch xl:flex-row xl:gap-14">
          <Illustration className="flex flex-col w-full max-w-98 shrink-0 rounded-xl overflow-clip bg-origin-border border border-solid border-[#FFFFFF12]" style={{ backgroundImage: 'radial-gradient(ellipse 156.12% 100% at 100% -0.8599999999999941% in oklab, var(--color-zinc-900) 0%, var(--color-zinc-950) 100%)' }}>
            <div className="flex items-center justify-between self-stretch pt-5.5 pb-4.75 px-5.5 border-b border-b-solid border-b-[#FFFFFF0F]">
              <div className="tracking-[-0.02em] font-sans font-medium text-[#FFFFFFED] text-base/tight">
                Metrics
              </div>
            </div>
            <div className="flex flex-col self-stretch pt-2.5 pb-4">
              <div className="flex items-center self-stretch py-2.75 px-5.5 gap-3">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <circle cx="9" cy="9" r="8.25" fill="rgb(6 115 255 / 18%)" stroke="rgb(6 115 255 / 55%)" />
                  <path d="M5.2 11.2 L8 8.2 L10 10 L12.9 6.6" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFED] text-[15px]/5">
                  Revenue
                </div>
                <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF80] text-xs/tight">
                  <CountUp value="$248,190" />
                </div>
              </div>
              <div className="flex flex-col self-stretch pl-8">
                <div className="flex flex-col self-stretch pl-3.5 border-l border-l-solid border-l-[#FFFFFF17]">
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <path d="M12 7a5 5 0 1 1-1.6-3.7" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="1.3" strokeLinecap="round" />
                      <path d="M12.2 1.6v2.6h-2.6" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFE0] text-[15px]/5">
                      Subscriptions
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.05} value="$214,730" />
                    </div>
                  </div>
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <rect x="1.4" y="3.4" width="11.2" height="8" rx="1.6" fill="none" stroke="var(--color-amber-500)" strokeWidth="1.3" />
                      <path d="M1.4 6.4h11.2" fill="none" stroke="var(--color-amber-500)" strokeWidth="1.3" />
                    </svg>
                    <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFE0] text-[15px]/5">
                      One-time purchases
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.1} value="$35,590" />
                    </div>
                  </div>
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <path d="M2 7a5 5 0 1 0 1.6-3.7" fill="none" stroke="var(--color-radical-red-400)" strokeWidth="1.3" strokeLinecap="round" />
                      <path d="M1.8 1.6v2.6h2.6" fill="none" stroke="var(--color-radical-red-400)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFE0] text-[15px]/5">
                      Refunds
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.15} value="−$2,130" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="self-stretch h-px shrink-0 bg-[#FFFFFF0F]" />
            <div className="flex flex-col self-stretch pt-2.5 pb-4">
              <div className="flex items-center self-stretch py-2.75 px-5.5 gap-3">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <circle cx="9" cy="9" r="8.25" fill="rgb(139 92 246 / 18%)" stroke="rgb(139 92 246 / 50%)" />
                  <circle cx="9" cy="7.1" r="2" fill="none" stroke="var(--color-electric-violet-300)" strokeWidth="1.3" />
                  <path d="M5.3 12.9c0-1.7 1.7-2.7 3.7-2.7s3.7 1 3.7 2.7" fill="none" stroke="var(--color-electric-violet-300)" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFED] text-[15px]/5">
                  Subscribers
                </div>
                <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF80] text-xs/tight">
                  <CountUp delay={0.15} value="41,208" />
                </div>
              </div>
              <div className="flex flex-col self-stretch pl-8">
                <div className="flex flex-col self-stretch pl-3.5 border-l border-l-solid border-l-[#FFFFFF17]">
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <path d="M7 1.8v7.4" fill="none" stroke="var(--color-pistachio-600)" strokeWidth="1.3" strokeLinecap="round" />
                      <path d="M4.3 6.6 7 9.3l2.7-2.7" fill="none" stroke="var(--color-pistachio-600)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 11.9h10" fill="none" stroke="var(--color-pistachio-600)" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFE0] text-[15px]/5">
                      Installs
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.2} value="412,806" />
                    </div>
                  </div>
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <path d="M7 1.6 8.5 5l3.6.4-2.7 2.5.8 3.5L7 9.7l-3.2 1.7.8-3.5L1.9 5.4 5.5 5 7 1.6Z" fill="none" stroke="var(--color-amber-500)" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFE0] text-[15px]/5">
                      Trial → paid
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.25} value="38.2%" />
                    </div>
                  </div>
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <path d="M2.2 4.6 7 9.4l4.8-4.8" fill="none" stroke="var(--color-radical-red-400)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M11.8 8.2V4.6H8.2" fill="none" stroke="var(--color-radical-red-400)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFE0] text-[15px]/5">
                      Churn
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.3} value="4.6%" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="self-stretch h-px shrink-0 bg-[#FFFFFF0F]" />
            <div className="flex flex-col self-stretch pt-2.5 pb-4">
              <div className="flex items-center self-stretch py-2.75 px-5.5 gap-3">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <circle cx="9" cy="9" r="8.25" fill="rgb(232 86 203 / 16%)" stroke="rgb(232 86 203 / 45%)" />
                  <path d="M4.6 9.4h2.1l1.4-3.2 1.8 6 1.3-2.8h2.2" fill="none" stroke="var(--color-fuchsia-pink-300)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="grow tracking-[-0.015em] w-max font-sans text-[#FFFFFFED] text-[15px]/5">
                  Events
                </div>
                <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF80] text-xs/tight">
                  <CountUp delay={0.35} value="6,342,428" />
                </div>
              </div>
              <div className="flex flex-col self-stretch pl-8">
                <div className="flex flex-col self-stretch pl-3.5 border-l border-l-solid border-l-[#FFFFFF17]">
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <rect x="3.6" y="1.6" width="6.8" height="10.8" rx="1.6" fill="none" stroke="var(--color-electric-violet-300)" strokeWidth="1.3" />
                      <path d="M6.2 10.6h1.6" fill="none" stroke="var(--color-electric-violet-300)" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    <div className="grow tracking-[0.005em] w-max font-mono text-[#FFFFFFCC] text-[13px]/5">
                      app_open
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.4} value="6,204,880" />
                    </div>
                  </div>
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <path d="M1.2 7S3.3 3.2 7 3.2 12.8 7 12.8 7 10.7 10.8 7 10.8 1.2 7 1.2 7Z" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="1.3" strokeLinejoin="round" />
                      <circle cx="7" cy="7" r="1.6" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="1.3" />
                    </svg>
                    <div className="grow tracking-[0.005em] w-max font-mono text-[#FFFFFFCC] text-[13px]/5">
                      paywall_view
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.45} value="96,340" />
                    </div>
                  </div>
                  <div className="flex items-center self-stretch pr-5.5 gap-2.5 py-2.25">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                      <path d="M2 3.2h1.9l1.5 6.6h5.2l1.4-4.7H4.4" fill="none" stroke="var(--color-pistachio-600)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="6.2" cy="11.6" r="0.9" fill="var(--color-pistachio-600)" />
                      <circle cx="10.2" cy="11.6" r="0.9" fill="var(--color-pistachio-600)" />
                    </svg>
                    <div className="grow tracking-[0.005em] w-max font-mono text-[#FFFFFFCC] text-[13px]/5">
                      purchase
                    </div>
                    <div className="shrink-0 w-22.5 text-right tracking-[0.01em] font-mono flex justify-end flex-wrap text-[#FFFFFF73] text-xs/tight">
                      <CountUp delay={0.5} value="41,208" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Illustration>
          <ScaledMock className="min-w-0 flex-1" designWidth={952}>
          <Illustration className="flex flex-col self-stretch relative">
            <svg aria-hidden="true" width="952" height="664" viewBox="0 0 952 664" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', left: '0px', top: '0px' }}>
              <defs><linearGradient id="_cbl8kr0" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.008"/><stop offset="16%" stopColor="#FFFFFF" stopOpacity="0.038"/><stop offset="88%" stopColor="#FFFFFF" stopOpacity="0.03"/><stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/></linearGradient><linearGradient id="_cbl8kr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.02"/><stop offset="16%" stopColor="#FFFFFF" stopOpacity="0.085"/><stop offset="88%" stopColor="#FFFFFF" stopOpacity="0.07"/><stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/></linearGradient><linearGradient id="_cbl8kr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF" stopOpacity="0"/><stop offset="18%" stopColor="#FFFFFF" stopOpacity="0.115"/><stop offset="88%" stopColor="#FFFFFF" stopOpacity="0.085"/><stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/></linearGradient></defs>
              <rect x="816" y="0" width="136" height="664" fill="rgb(255 255 255 / 1.4%)" />
              <path d="M68 0V664 M204 0V664 M340 0V664 M476 0V664 M612 0V664 M748 0V664 M884 0V664" fill="none" stroke="url(#_cbl8kr0)" strokeDasharray="2 6" />
              <path d="M136 0V664 M272 0V664 M408 0V664 M544 0V664 M680 0V664" fill="none" stroke="url(#_cbl8kr1)" strokeDasharray="2 6" />
              <path d="M816 0V664" fill="none" stroke="url(#_cbl8kr2)" />
            </svg>
            <div className="flex self-stretch pb-6 relative">
              <div className="flex flex-col w-34 shrink-0 gap-2.25">
                <div className="w-max font-sans font-medium text-[#FFFFFF80] text-xs/4">
                  Feb
                </div>
                <div className="flex">
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF1F] text-[11px]/3.25">
                    2
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF1F] text-[11px]/3.25">
                    9
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF1F] text-[11px]/3.25">
                    16
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF1F] text-[11px]/3.25">
                    23
                  </div>
                </div>
              </div>
              <div className="flex flex-col w-34 shrink-0 gap-2.25">
                <div className="w-max font-sans font-medium text-[#FFFFFF80] text-xs/4">
                  Mar
                </div>
                <div className="flex">
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    2
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    9
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    16
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    23
                  </div>
                </div>
              </div>
              <div className="flex flex-col w-34 shrink-0 gap-2.25">
                <div className="w-max font-sans font-medium text-[#FFFFFF80] text-xs/4">
                  Apr
                </div>
                <div className="flex">
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    6
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    13
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    20
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    27
                  </div>
                </div>
              </div>
              <div className="flex flex-col w-34 shrink-0 gap-2.25">
                <div className="w-max font-sans font-medium text-[#FFFFFF80] text-xs/4">
                  May
                </div>
                <div className="flex">
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    4
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    11
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    18
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    25
                  </div>
                </div>
              </div>
              <div className="flex flex-col w-34 shrink-0 gap-2.25">
                <div className="w-max font-sans font-medium text-[#FFFFFF80] text-xs/4">
                  Jun
                </div>
                <div className="flex">
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    1
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    8
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    15
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    22
                  </div>
                </div>
              </div>
              <div className="flex flex-col w-34 shrink-0 gap-2.25">
                <div className="w-max font-sans font-medium text-[#FFFFFF80] text-xs/4">
                  Jul
                </div>
                <div className="flex">
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    6
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    13
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    20
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF3D] text-[11px]/3.25">
                    27
                  </div>
                </div>
              </div>
              <div className="flex flex-col w-34 shrink-0 gap-2.25">
                <div className="w-max font-sans font-medium text-[#FFFFFF80] text-xs/4">
                  Aug
                </div>
                <div className="flex">
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF21] text-[11px]/3.25">
                    3
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF21] text-[11px]/3.25">
                    10
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF21] text-[11px]/3.25">
                    17
                  </div>
                  <div className="w-8.5 shrink-0 tracking-[0.04em] font-mono text-[#FFFFFF21] text-[11px]/3.25">
                    24
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between self-stretch pb-6.5 relative">
              <div className="flex flex-col gap-3">
                <div className="tracking-[-0.01em] w-max font-sans font-medium text-[#FFFFFFB2] text-[13px]/4">
                  Monthly recurring revenue
                </div>
                <div className="flex items-end gap-3.5">
                  <div className="tracking-[-0.04em] w-max shrink-0 font-sans font-semibold text-zinc-300 text-[46px]/11.5">
                    <CountUp value="$48,190" />
                  </div>
                  <div className="pb-1.25">
                    <div className="tracking-[-0.01em] w-max font-sans font-medium [color:var(--color-pistachio-600)] text-[13px]/4">
                      <CountUp delay={0.15} value="+12.4%" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <ChartWipe className="relative shrink-0">
            <svg aria-hidden="true" width="952" height="220" viewBox="0 0 952 220" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
              <defs><linearGradient id="_7gznpr0" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--blue-ribbon-600)" stopOpacity="0.2"/><stop offset="72%" stopColor="var(--blue-ribbon-600)" stopOpacity="0.02"/><stop offset="100%" stopColor="var(--blue-ribbon-600)" stopOpacity="0"/></linearGradient><linearGradient id="_7gznpr1" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--blue-ribbon-600)" stopOpacity="0"/><stop offset="14%" stopColor="var(--blue-ribbon-600)"/><stop offset="100%" stopColor="var(--blue-ribbon-600)"/></linearGradient><linearGradient id="_7gznpr2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FFFFFF" stopOpacity="0"/><stop offset="16%" stopColor="#FFFFFF" stopOpacity="0.22"/><stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.22"/></linearGradient></defs>
              <path d="M0 188 L68 180 L136 184 L204 166 L272 158 L340 164 L408 142 L476 130 L544 136 L612 112 L680 96 L748 100 L816 66 L816 220 L0 220 Z" fill="url(#_7gznpr0)" />
              <path d="M0 206 L68 202 L136 205 L204 196 L272 192 L340 195 L408 186 L476 180 L544 183 L612 174 L680 168 L748 170 L816 158" fill="none" stroke="url(#_7gznpr2)" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="3 4" />
              <path d="M0 188 L68 180 L136 184 L204 166 L272 158 L340 164 L408 142 L476 130 L544 136 L612 112 L680 96 L748 100 L816 66" fill="none" stroke="url(#_7gznpr1)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M816 66 L884 52 L952 36" fill="none" stroke="#0673FF6B" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 5" />
              <path d="M816 59.5 L822.5 66 L816 72.5 L809.5 66 Z" fill="var(--zinc-950)" stroke="var(--blue-ribbon-600)" strokeWidth="1.3" />
            </svg>
            </ChartWipe>
            <div className="flex items-center justify-between self-stretch pt-4 relative">
              <div className="flex items-center gap-5.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.75 h-1.75 shrink-0 rounded-[999px] [background-color:var(--color-blue-ribbon-500)]" />
                  <div className="w-max shrink-0 font-sans text-[#FFFFFF8A] text-xs/4">
                    Subscription revenue
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <svg aria-hidden="true" width="14" height="7" viewBox="0 0 14 7" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M0 3.5h14" fill="none" stroke="rgb(255 255 255 / 26%)" strokeWidth="1.4" strokeDasharray="3 3" />
                  </svg>
                  <div className="w-max shrink-0 font-sans text-[#FFFFFF8A] text-xs/4">
                    Previous period
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" width="14" height="7" viewBox="0 0 14 7" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M0 3.5h14" fill="none" stroke="rgb(6 115 255 / 50%)" strokeWidth="1.4" strokeDasharray="3 3" />
                </svg>
                <div className="w-max shrink-0 font-sans text-[#0673FFCC] text-xs/4">
                  Projected
                </div>
              </div>
            </div>
            <div className="flex flex-col self-stretch pt-9.5 gap-5 relative">
              <div className="flex flex-col self-stretch gap-1.75">
                <div className="tracking-[-0.01em] w-max font-sans font-medium text-[#FFFFFFB2] text-[13px]/4">
                  Retention by cohort
                </div>
              </div>
              <div className="flex flex-col self-stretch gap-1.5">
                <div className="flex self-stretch h-7 shrink-0">
                  <div className="w-34 shrink-0 flex items-center justify-end pr-3">
                    <div className="w-max shrink-0 font-sans text-[#FFFFFF8A] text-xs/4">
                      Mar · 3,180
                    </div>
                  </div>
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF33] border border-solid border-[#0673FF4D]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFD1] text-[11px]/3.25">
                      <CountUp delay={0.3} value="100" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF29] border border-solid border-[#0673FF47]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFB3] text-[11px]/3.25">
                      <CountUp delay={0.335} value="82" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF24] border border-solid border-[#0673FF42]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFA8] text-[11px]/3.25">
                      <CountUp delay={0.37} value="71" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF1F] border border-solid border-[#0673FF3D]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFA1] text-[11px]/3.25">
                      <CountUp delay={0.405} value="64" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF1A] border border-solid border-[#0673FF38]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFF99] text-[11px]/3.25">
                      <CountUp delay={0.44} value="59" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 h-7 rounded-[5px] bg-[#0673FF08] border border-dashed border-[#0673FF52]" />
                </div>
                <div className="flex self-stretch h-7 shrink-0">
                  <div className="w-68 shrink-0 flex items-center justify-end pr-3">
                    <div className="w-max shrink-0 font-sans text-[#FFFFFF8A] text-xs/4">
                      Apr · 3,940
                    </div>
                  </div>
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF33] border border-solid border-[#0673FF4D]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFD1] text-[11px]/3.25">
                      <CountUp delay={0.475} value="100" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF2A] border border-solid border-[#0673FF47]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFB3] text-[11px]/3.25">
                      <CountUp delay={0.51} value="84" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF25] border border-solid border-[#0673FF42]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFA8] text-[11px]/3.25">
                      <CountUp delay={0.545} value="74" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF21] border border-solid border-[#0673FF3D]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFA1] text-[11px]/3.25">
                      <CountUp delay={0.58} value="68" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 h-7 rounded-[5px] bg-[#0673FF08] border border-dashed border-[#0673FF52]" />
                </div>
                <div className="flex self-stretch h-7 shrink-0">
                  <div className="w-102 shrink-0 flex items-center justify-end pr-3">
                    <div className="w-max shrink-0 font-sans text-[#FFFFFF8A] text-xs/4">
                      May · 4,610
                    </div>
                  </div>
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF33] border border-solid border-[#0673FF4D]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFD1] text-[11px]/3.25">
                      <CountUp delay={0.615} value="100" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF2B] border border-solid border-[#0673FF47]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFB3] text-[11px]/3.25">
                      <CountUp delay={0.65} value="86" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF26] border border-solid border-[#0673FF42]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFA8] text-[11px]/3.25">
                      <CountUp delay={0.685} value="77" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 h-7 rounded-[5px] bg-[#0673FF08] border border-dashed border-[#0673FF52]" />
                </div>
                <div className="flex self-stretch h-7 shrink-0">
                  <div className="w-136 shrink-0 flex items-center justify-end pr-3">
                    <div className="w-max shrink-0 font-sans text-[#FFFFFF8A] text-xs/4">
                      Jun · 5,120
                    </div>
                  </div>
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF33] border border-solid border-[#0673FF4D]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFD1] text-[11px]/3.25">
                      <CountUp delay={0.72} value="100" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF2B] border border-solid border-[#0673FF47]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFB3] text-[11px]/3.25">
                      <CountUp delay={0.755} value="88" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 h-7 rounded-[5px] bg-[#0673FF08] border border-dashed border-[#0673FF52]" />
                </div>
                <div className="flex self-stretch h-7 shrink-0">
                  <div className="w-170 shrink-0 flex items-center justify-end pr-3">
                    <div className="w-max shrink-0 font-sans text-[#FFFFFF8A] text-xs/4">
                      Jul · 5,860
                    </div>
                  </div>
                  <div className="w-33 shrink-0 flex items-center justify-center h-7 rounded-[5px] bg-[#0673FF33] border border-solid border-[#0673FF4D]">
                    <div className="tracking-[0.02em] font-mono text-[#FFFFFFD1] text-[11px]/3.25">
                      <CountUp delay={0.79} value="100" />
                    </div>
                  </div>
                  <div className="w-1 shrink-0" />
                  <div className="w-33 shrink-0 h-7 rounded-[5px] bg-[#0673FF08] border border-dashed border-[#0673FF52]" />
                </div>
              </div>
            </div>
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(ellipse 78.55% 116.835% at 22.040000000000003% 0% in oklab, oklab(17.1% 0 0 / 0%) 30.12%, oklab(14.1% 0.001 -0.004) 100%)' }} />
          </Illustration>
          </ScaledMock>
        </div>
      </div>
    </LandingSection>
  );
}
