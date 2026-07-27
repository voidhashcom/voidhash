"use client";

import { Button, cn, Slider } from "@voidhash/ui";
import { useMemo, useState } from "react";

import { LandingSection, SectionHeader } from "@/features/www/landing/shared";
import { signUpCtaLabel } from "@/lib/waitlist";

import {
  estimate,
  EVENTS_METER,
  formatRate,
  formatUsd,
  type Meter,
  TRACKED_REVENUE_METER,
} from "../pricing-model";

/** Same panel treatment as the landing product cards. */
const PANEL_BACKGROUND =
  "radial-gradient(ellipse 100% 100% at 0% 0% in oklab, var(--color-zinc-900) 0%, var(--color-zinc-950) 100%)";

/**
 * Slider resolution. Step 0 is reserved for a volume of zero and the remaining steps carry the
 * logarithmic ramp, so every slider has a real "nothing yet" position at its left edge.
 */
const SLIDER_STEPS = 1000;

/** Rounds to two significant figures so dragging lands on 3.2M rather than 3,184,721. */
function roundToTwoSignificantFigures(value: number): number {
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

function positionToVolume(meter: Meter, position: number): number {
  if (position <= 0) {
    return 0;
  }
  const ratio = meter.sliderMax / meter.sliderFloor;
  const progress = (position - 1) / (SLIDER_STEPS - 1);
  return roundToTwoSignificantFigures(meter.sliderFloor * ratio ** progress);
}

function volumeToPosition(meter: Meter, volume: number): number {
  if (volume <= 0) {
    return 0;
  }
  const ratio = meter.sliderMax / meter.sliderFloor;
  const clamped = Math.min(meter.sliderMax, Math.max(meter.sliderFloor, volume));
  return 1 + (Math.log(clamped / meter.sliderFloor) / Math.log(ratio)) * (SLIDER_STEPS - 1);
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-zinc-900 border-b py-2.5 last:border-b-0">
      <div className="font-sans text-[13px]/4 text-zinc-400 tracking-[-0.01em]">{label}</div>
      <div className="font-mono text-[13px]/4 text-white">{value}</div>
    </div>
  );
}

function VolumeInput({
  meter,
  onChange,
  value,
}: {
  meter: Meter;
  onChange: (value: number) => void;
  value: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const dollars = meter.id === "trackedRevenue";

  const commit = () => {
    const cleaned = (draft ?? "").replace(/[^\d]/g, "");
    if (cleaned !== "") {
      onChange(Math.min(meter.sliderMax, Number(cleaned)));
    }
    setDraft(null);
  };

  return (
    <div className="flex items-baseline gap-1">
      {dollars ? (
        <span className="font-medium font-sans text-[28px] text-white leading-none tracking-[-0.03em]">
          $
        </span>
      ) : null}
      <input
        aria-label={`Monthly ${meter.label.toLowerCase()}`}
        className="w-full min-w-0 bg-transparent font-medium font-sans text-[28px] text-white leading-none tracking-[-0.03em] outline-none focus:text-blue-ribbon-300"
        inputMode="numeric"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        value={draft ?? value.toLocaleString("en-US")}
      />
    </div>
  );
}

function MeterControl({
  meter,
  onChange,
  value,
}: {
  meter: Meter;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="font-medium font-sans text-white text-[15px]/4.5 tracking-[-0.02em]">
          {meter.label}
        </div>
        <p className="max-w-[420px] font-sans text-[13px]/4.5 text-zinc-400 tracking-[-0.01em]">
          {meter.description}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <VolumeInput meter={meter} onChange={onChange} value={value} />
        <Slider
          aria-label={`Monthly ${meter.label.toLowerCase()} slider`}
          max={SLIDER_STEPS}
          min={0}
          onValueChange={([position]) => onChange(positionToVolume(meter, position))}
          step={1}
          value={[volumeToPosition(meter, value)]}
        />
        <div className="flex items-center justify-between font-sans text-xs/4 text-zinc-500">
          <span>{meter.formatVolume(0)}</span>
          <span>{meter.formatVolume(meter.sliderMax)}</span>
        </div>
      </div>
      <div className="flex flex-col">
        <RateRow label="Included on Free" value={meter.formatVolume(meter.freeAllowance)} />
        <RateRow label="Included on Grow" value={meter.formatVolume(meter.growAllowance)} />
        <RateRow
          label="Every unit after that"
          value={`${formatRate(meter.rate)} / ${meter.unitLabel}`}
        />
      </div>
    </div>
  );
}

function SummaryRow({
  amount,
  detail,
  label,
  muted,
}: {
  amount: string;
  detail?: string;
  label: string;
  muted: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-zinc-900 border-b px-6 py-4.5">
      <div className="flex flex-col gap-1">
        <div className="font-sans text-[15px]/4.5 text-zinc-200 tracking-[-0.02em]">{label}</div>
        {detail ? (
          <div className="font-sans text-xs/4 text-zinc-500 tracking-[-0.01em]">{detail}</div>
        ) : null}
      </div>
      <div
        className={cn(
          "shrink-0 font-medium font-mono text-[15px]/4.5",
          muted ? "text-zinc-500" : "text-white",
        )}
      >
        {amount}
      </div>
    </div>
  );
}

/** Renders the interactive monthly bill estimator. */
export function PricingCalculator() {
  // Both meters start at zero, so the first thing anyone sees is a $0 bill.
  const [revenue, setRevenue] = useState(0);
  const [events, setEvents] = useState(0);

  const bill = useMemo(() => estimate(revenue, events), [revenue, events]);
  const onFree = bill.plan === "free";

  return (
    <LandingSection id="calculator">
      <div className="flex flex-col items-start gap-12 px-6 py-16 md:gap-16 md:px-12 md:py-24 xl:p-32">
        <SectionHeader
          description="Drag the two meters to your own numbers. No sales call needed to find out what Voidhash costs."
          eyebrow="Estimate"
          title="Work out your bill before you commit."
        />
        <div className="flex w-full flex-col items-start gap-10 xl:flex-row xl:gap-16">
          <div className="flex w-full min-w-0 flex-col gap-12 xl:flex-1">
            <MeterControl meter={TRACKED_REVENUE_METER} onChange={setRevenue} value={revenue} />
            <MeterControl meter={EVENTS_METER} onChange={setEvents} value={events} />
          </div>
          <div
            className="flex w-full flex-col overflow-clip rounded-lg border border-zinc-800 border-solid xl:w-107.25 xl:shrink-0"
            style={{ backgroundImage: PANEL_BACKGROUND }}
          >
            <div className="flex items-center justify-between border-zinc-800 border-b px-6 py-5">
              <div className="font-medium font-sans text-[15px]/4.5 text-white tracking-[-0.02em]">
                Your monthly bill
              </div>
              <div className="font-sans text-xs/4 text-zinc-400">
                {onFree ? "Free plan" : "Grow plan"}
              </div>
            </div>
            <SummaryRow
              amount={formatUsd(bill.base)}
              detail="Platform access"
              label="Base"
              muted={onFree}
            />
            <SummaryRow
              amount={formatUsd(bill.trackedRevenue)}
              detail={`${TRACKED_REVENUE_METER.formatVolume(revenue)} tracked`}
              label="Tracked revenue"
              muted={bill.trackedRevenue === 0}
            />
            <SummaryRow
              amount={formatUsd(bill.events)}
              detail={`${EVENTS_METER.formatVolume(events)} events`}
              label="Events"
              muted={bill.events === 0}
            />
            <div className="flex flex-col gap-5 px-6 py-6.5">
              <div className="flex items-end justify-between gap-4">
                <div className="font-sans text-[15px]/4.5 text-zinc-200 tracking-[-0.02em]">
                  Estimated total
                </div>
                <div className="font-medium font-sans text-[32px] text-white leading-none tracking-[-0.03em]">
                  {formatUsd(bill.total)}
                </div>
              </div>
              <p className="font-sans text-[13px]/4.5 text-zinc-400 tracking-[-0.01em]">
                {onFree
                  ? "At this volume you fit inside the Free plan — no card, nothing to pay."
                  : revenue > 0
                    ? `That works out to ${((bill.total / revenue) * 100).toFixed(2)}% of the revenue we track for you.`
                    : "Billed monthly in arrears. Change plan or cancel at any time."}
              </p>
              <Button asChild className="w-full" size="lg">
                <a href="/auth/sign-up">{signUpCtaLabel("Start for free")}</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </LandingSection>
  );
}
