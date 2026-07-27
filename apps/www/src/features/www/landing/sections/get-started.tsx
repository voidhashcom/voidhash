import { Button } from "@voidhash/ui";
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { HeroShader } from "@/features/www/hero/hero-shader";
import { signUpCtaLabel } from "@/lib/waitlist";

import { LandingSection } from "../shared";

const COMMUNITY_CARDS: {
  title: string;
  description: string;
  action: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    title: "GitHub",
    description: "The full platform, SDKs and paywall examples in one repo.",
    action: "Star the repo",
    href: "https://github.com/voidhashcom/voidhash",
    icon: (
      <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
        <path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.05 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.92-2.34 4.79-4.57 5.04.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.06 10.06 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z" fill="var(--zinc-400)" />
      </svg>
    ),
  },
  {
    title: "Discord",
    description: "Ask questions, share paywalls and get support straight from the team.",
    action: "Join the server",
    href: "https://discord.gg/voidhash",
    icon: (
      <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
        <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.79.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.32.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .31.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.94.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .78.009c.12.099.246.198.373.292a.077.077 0 0 1-.6.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.41.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .84.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" fill="var(--zinc-400)" />
      </svg>
    ),
  },
  {
    title: "Docs",
    description: "Guides, API reference and a hello-world integration for every SDK.",
    action: "Browse docs",
    href: "/docs",
    icon: (
      <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: '0' }}>
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10a2 2 0 0 1 2 2v15a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5v-12Z" fill="none" stroke="var(--zinc-400)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H14a2 2 0 0 0-2 2v15a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5v-12Z" fill="none" stroke="var(--zinc-400)" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/** Renders the closing call to action, backed by the lenticular gradient shader. */
export function LandingGetStarted() {
  return (
    <LandingSection>
      <div className="relative flex flex-col items-center justify-center overflow-clip px-6 py-24 md:py-36 xl:py-44">
        <div className="absolute inset-0">
          <HeroShader />
        </div>
        <div className="relative flex flex-col items-center gap-8 md:gap-11">
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-balance text-center font-medium font-sans text-[36px] text-white leading-[110%] tracking-[-0.03em] md:text-[48px] xl:text-[56px]">
              Get started today
            </h2>
            <p className="max-w-[500px] text-center font-sans text-zinc-400 text-base/6.5 tracking-[-0.03em] md:text-xl/8">
              Create a project, drop in the SDK, ship your first paywall. All in an afternoon.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 pt-1 sm:flex-row">
            <Button asChild size="lg">
              <a href="/auth/sign-up">
                {signUpCtaLabel("Get started for free")}
                <ChevronRightIcon data-icon="inline-end" />
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="/docs">
                View docs
                <ChevronRightIcon data-icon="inline-end" />
              </a>
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 divide-y divide-zinc-800 border-zinc-800 border-t md:grid-cols-3 md:divide-x md:divide-y-0">
        {COMMUNITY_CARDS.map((card) => (
          <div
            className="flex flex-col items-center gap-5 px-8 py-12 md:px-14 md:py-18"
            key={card.title}
          >
            {card.icon}
            <div className="flex flex-col items-center gap-2.5">
              <div className="font-medium font-sans text-zinc-50 text-xl leading-[120%] tracking-[-0.02em]">
                {card.title}
              </div>
              <p className="max-w-[340px] text-center font-sans text-zinc-400 text-base/6.5 tracking-[-0.01em]">
                {card.description}
              </p>
            </div>
            <Button asChild variant="outline">
              <a
                href={card.href}
                rel={card.href.startsWith("http") ? "noreferrer" : undefined}
                target={card.href.startsWith("http") ? "_blank" : undefined}
              >
                {card.action}
                <ArrowUpRightIcon data-icon="inline-end" />
              </a>
            </Button>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}
