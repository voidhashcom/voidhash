"use client";
// import { ChevronRight } from 'lucide-react';

import { VoidhashGradientBackground } from "@/components/voidhash-gradient-background";

import { Button } from "../button";
// import { Button } from '../button';
import { SectionContainer } from "../section/section-container";

export function Hero() {
  return (
    <SectionContainer className="w-full">
      <section className="relative isolate flex min-h-[760px] flex-col items-center overflow-hidden pt-26 sm:min-h-[780px] lg:min-h-[820px]">
        <div className="absolute inset-x-0 bottom-0 z-0 h-[430px] sm:h-[470px] lg:h-[520px]">
          <VoidhashGradientBackground
            controlsQueryParam="heroControls"
            controlsStorageKey="voidhash:hero-three-controls"
            controlsTitle="Hero FX"
            settingsStorageKey="voidhash:hero-three-settings"
          />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="rounded-full border border-border bg-card px-4 py-1 font-semibold text-muted-foreground text-sm">
            Closed Alpha Preview - Now Available
          </div>
          <h1 className="mt-6 max-w-xl text-balance text-center font-semibold text-5xl leading-tight tracking-tight">
            Add in-app purchases to React Native in seconds.
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-center text-muted-foreground">
            Voidhash is an open-source subscription management platform for React Native that allows
            you to integrate Google Play and App Store purchases with single command.
          </p>
          <div className="mt-10 flex w-full items-center justify-center gap-4">
            <form
              action="https://formspree.io/f/mpwjvpve"
              aria-label="Join waitlist"
              className="flex w-full max-w-md flex-col items-center gap-2 rounded-xl border bg-card p-1 sm:flex-row"
              method="POST"
            >
              <label className="sr-only" htmlFor="waitlist-email">
                Email address
              </label>
              <input
                aria-label="Email address"
                autoComplete="email"
                className="flex-1 rounded-md bg-background px-4 py-2 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                id="waitlist-email"
                name="email"
                placeholder="Enter your email"
                required
                type="email"
              />

              <Button className="w-full sm:w-auto" type="submit">
                Join Waitlist
              </Button>
            </form>
            {/* <Button>
              <span>Get Started</span>
              <ChevronRight className="size-4 opacity-50" />
            </Button>
            <Button variant="ghost">
              <span>Documentation</span>
              <ChevronRight className="size-4 opacity-50" />
            </Button> */}
          </div>
        </div>
      </section>
    </SectionContainer>
  );
}
