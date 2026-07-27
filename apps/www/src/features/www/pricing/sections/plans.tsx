import { Button, cn } from "@voidhash/ui";
import { CheckIcon } from "lucide-react";

import { LandingSection } from "@/features/www/landing/shared";

import { type Plan, PLANS } from "../plans";
import { PricingSelfHost } from "./self-host";

/** Lifts the recommended column off the flat surface without boxing it in a card. */
const HIGHLIGHT_BACKGROUND =
  "radial-gradient(ellipse 100% 100% at 50% 0% in oklab, var(--color-zinc-900) 0%, var(--color-zinc-950) 100%)";

function PlanColumn({ plan }: { plan: Plan }) {
  const recommended = plan.id === "grow";

  return (
    <div
      className="flex flex-col gap-8 px-6 py-12 md:px-10 md:py-14"
      style={recommended ? { backgroundImage: HIGHLIGHT_BACKGROUND } : undefined}
    >
      <div className="flex flex-col gap-6">
        <div className="font-medium font-sans text-white text-xl leading-[120%] tracking-[-0.02em]">
          {plan.name}
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-sans text-zinc-500 text-[13px]/4 tracking-[-0.01em]">
            {plan.priceNote}
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-medium font-sans text-[44px] text-white leading-[110%] tracking-[-0.03em]">
              {plan.price}
            </div>
            {plan.priceSuffix ? (
              <div className="font-sans text-[15px]/5 text-zinc-400 tracking-[-0.01em]">
                {plan.priceSuffix}
              </div>
            ) : null}
          </div>
        </div>
        <p className="min-h-16 max-w-[360px] font-sans text-[15px]/6 text-zinc-400 tracking-[-0.01em]">
          {plan.description}
        </p>
        <Button
          asChild
          className="w-full"
          size="lg"
          variant={recommended ? "default" : "outline"}
        >
          <a href={plan.cta.href}>{plan.cta.label}</a>
        </Button>
      </div>
      <div className="flex flex-col gap-3.5 border-zinc-800 border-t pt-8">
        {plan.highlights.map((highlight) => (
          <div className="flex items-start gap-3" key={highlight}>
            <CheckIcon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                recommended ? "text-blue-ribbon-400" : "text-zinc-500",
              )}
            />
            <div className="font-sans text-[15px]/5.5 text-zinc-200 tracking-[-0.01em]">
              {highlight}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Renders the three plan columns. */
export function PricingPlans() {
  return (
    <LandingSection>
      <div className="grid grid-cols-1 divide-y divide-zinc-800 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {PLANS.map((plan) => (
          <PlanColumn key={plan.id} plan={plan} />
        ))}
      </div>
      <PricingSelfHost />
    </LandingSection>
  );
}
