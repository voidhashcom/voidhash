"use client";

import { Button } from "@voidhash/ui";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { LandingSection, SectionHeader } from "../shared";

const INSTALL_COMMAND = "npx voidhash-cli init";

function CopyCommandButton() {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      aria-label="Copy install command"
      onClick={() => {
        navigator.clipboard.writeText(INSTALL_COMMAND);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      size="icon-sm"
      variant="outline"
    >
      {copied ? <CheckIcon className="text-blue-ribbon-400" /> : <CopyIcon />}
    </Button>
  );
}

/** Renders the developer platform section. */
export function LandingDevelopers() {
  return (
    <LandingSection id="developers">
      <div className="flex flex-col items-start justify-center gap-12 px-6 py-16 md:gap-23 md:px-12 md:py-24 xl:p-32">
        <SectionHeader
          description="One install and one provider. Paywalls, experiments, entitlements and analytics all arrive wired together — no bridge code, no event plumbing."
          eyebrow="Developers"
          title="Install the SDK before your coffee gets cold."
        />
        <div className="w-full max-w-[1400px] flex flex-col items-start gap-5">
          <div className="self-stretch min-w-0 flex gap-12">
            <div className="flex flex-col rounded-[16px] overflow-clip flex-1 min-w-0 h-fit grow basis-[0%] self-stretch [box-shadow:#00000059_0px_2px_24px] bg-zinc-950 border border-solid border-zinc-800">
              <div className="self-stretch flex items-center py-2.5 px-3.5 gap-1.5 overflow-x-auto border-b border-b-solid border-b-zinc-900">
                <div className="flex items-center py-2 px-3.25 rounded-md gap-2.25 bg-zinc-900">
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <circle cx="12" cy="12" r="2.1" fill="var(--color-blue-ribbon-400)" />
                    <ellipse cx="12" cy="12" rx="10" ry="3.9" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="1.4" />
                    <ellipse cx="12" cy="12" rx="10" ry="3.9" transform="rotate(60 12 12)" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="1.4" />
                    <ellipse cx="12" cy="12" rx="10" ry="3.9" transform="rotate(120 12 12)" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="1.4" />
                  </svg>
                  <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans font-medium text-zinc-50">
                    React Native
                  </div>
                </div>
                <div className="flex items-center py-2 px-3.25 gap-2.25">
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M17.05 12.54c-.03-2.91 2.38-4.31 2.49-4.38-1.36-1.99-3.47-2.26-4.22-2.29-1.8-.18-3.51 1.06-4.42 1.06-.91 0-2.32-1.03-3.81-1-1.96.03-3.77 1.14-4.78 2.89-2.04 3.54-.52 8.78 1.46 11.65.97 1.4 2.12 2.98 3.63 2.92 1.46-.06 2.01-.94 3.77-.94 1.76 0 2.26.94 3.8.91 1.57-.03 2.56-1.43 3.52-2.84 1.11-1.63 1.57-3.21 1.6-3.29-.04-.02-3.07-1.18-3.04-4.69Z" fill="var(--zinc-500)" />
                    <path d="M14.13 4.06c.8-.98 1.35-2.33 1.2-3.68-1.16.05-2.57.78-3.4 1.75-.74.86-1.4 2.24-1.22 3.56 1.3.1 2.62-.66 3.42-1.63Z" fill="var(--zinc-500)" />
                  </svg>
                  <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-400">
                    Swift
                  </div>
                  <div className="text-[13px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-500">
                    Soon
                  </div>
                </div>
                <div className="flex items-center py-2 px-3.25 gap-2.25">
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M24 24H0V0h24L12 12l12 12Z" fill="var(--zinc-500)" />
                  </svg>
                  <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-400">
                    Kotlin
                  </div>
                  <div className="text-[13px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-500">
                    Soon
                  </div>
                </div>
                <div className="grow basis-[0%] h-px" />
                <CopyCommandButton />
              </div>
              <div className="self-stretch flex flex-col py-8 md:py-11.5">
                <div className="self-stretch flex items-center px-5 md:px-7 gap-3.5">
                  <div className="w-max inline-block shrink-0 font-mono text-zinc-600 text-base/6 md:text-xl/7.5">
                    $
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2">
                    <div className="w-max inline-block shrink-0 font-mono text-zinc-400 text-base/6 md:text-xl/7.5">
                      npx
                    </div>
                    <div className="w-max inline-block shrink-0 font-mono font-medium text-zinc-50 text-base/6 md:text-xl/7.5">
                      voidhash-cli
                    </div>
                    <div className="w-max inline-block shrink-0 font-mono font-medium text-blue-ribbon-400 text-base/6 md:text-xl/7.5">
                      init
                    </div>
                  </div>
                </div>
              </div>
              <div className="self-stretch flex flex-wrap items-center py-4 px-5 md:px-7 gap-x-7 gap-y-2 border-t border-t-solid border-t-zinc-900">
                <a className="flex items-center gap-2.25 transition-opacity hover:opacity-80" href="/docs">
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                    <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2v15a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5v-12Z" fill="none" stroke="var(--zinc-400)" strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H14a2 2 0 0 0-2 2v15a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5v-12Z" fill="none" stroke="var(--zinc-400)" strokeWidth="1.7" strokeLinejoin="round" />
                  </svg>
                  <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-300">
                    Read the docs
                  </div>
                </a>
                <div className="grow basis-[0%] h-px" />
                <div className="text-[13px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-mono text-zinc-500">
                  Expo SDK 52+ · New Architecture ready
                </div>
              </div>
            </div>
          </div>
          <div className="self-stretch flex flex-wrap items-center gap-y-3 pt-5 px-0.5">
            <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-400">
              Wired automatically, zero config
            </div>
            <div className="grow basis-[0%] h-px" />
            <div className="flex flex-wrap items-center gap-x-7.5 gap-y-3">
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-300">
                  Paywalls
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-300">
                  Purchases
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-300">
                  Entitlements
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-300">
                  Experiments
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
                  <path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="var(--color-blue-ribbon-400)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-[15px] tracking-[-0.01em] leading-[120%] w-max shrink-0 font-sans text-zinc-300">
                  Analytics
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
