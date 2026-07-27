import { cn } from "@voidhash/ui";
import { CheckIcon, MinusIcon } from "lucide-react";

import { LandingSection, SectionHeader } from "@/features/www/landing/shared";

import { MATRIX, type MatrixValue, PLANS } from "../plans";

/**
 * Height of the sticky navbar the header row has to clear: 32px of controls plus its padding
 * (`p-4` on mobile, `p-6` from `md`) and the hairline underneath.
 */
const HEADER_OFFSET = "top-[65px] md:top-[81px]";

/** Shared column geometry, so the header row and every body row land in the same lanes. */
const ROW = "flex items-stretch gap-4 px-6 md:px-12 xl:px-32";

/** The matrix minus rows for capabilities we have not shipped, and any group left empty by that. */
const VISIBLE_MATRIX = MATRIX.map((group) => ({
  ...group,
  rows: group.rows.filter((row) => !row.hidden),
})).filter((group) => group.rows.length > 0);
const LABEL_CELL = "flex-1 min-w-0 py-4";
const VALUE_CELL = "w-32 shrink-0 py-4 md:w-40";

function Cell({ value }: { value: MatrixValue }) {
  if (value === true) {
    return <CheckIcon className="size-4 text-zinc-200" />;
  }
  if (value === false) {
    return <MinusIcon className="size-4 text-zinc-700" />;
  }
  return (
    <div className="font-sans text-[13px]/4.5 text-zinc-200 tracking-[-0.01em]">{value}</div>
  );
}

/** Renders the plan comparison matrix. */
export function PricingMatrix() {
  return (
    <LandingSection id="compare">
      <div className="flex flex-col items-start gap-12 px-6 pt-16 md:gap-16 md:px-12 md:pt-24 xl:px-32 xl:pt-32">
        <SectionHeader
          description="Every plan ships the whole product. What changes is how much you can send us, and how much help you get."
          eyebrow="Compare"
          title="One platform, three ways to buy it."
        />
      </div>
      <div className="mt-12 overflow-x-auto md:mt-16 lg:overflow-x-visible">
        <div className="min-w-[840px] lg:min-w-0">
          <div
            className={cn(
              ROW,
              HEADER_OFFSET,
              "sticky z-10 items-end border-zinc-800 border-y bg-zinc-950/95 backdrop-blur-md",
            )}
          >
            <div className={cn(LABEL_CELL, "font-sans text-xs/4 text-zinc-500")}>Feature</div>
            {PLANS.map((plan) => (
              <div
                className={cn(
                  VALUE_CELL,
                  "font-medium font-sans text-sm/4.5 tracking-[-0.02em]",
                  plan.id === "grow" ? "text-white" : "text-zinc-300",
                )}
                key={plan.id}
              >
                {plan.name}
              </div>
            ))}
          </div>
          {VISIBLE_MATRIX.map((group) => (
            <div key={group.title}>
              <div
                className={cn(
                  ROW,
                  "border-zinc-800 border-b bg-zinc-900/30 py-3",
                  "font-medium font-sans text-[13px]/4.5 text-zinc-400 tracking-[-0.01em]",
                )}
              >
                {group.title}
              </div>
              {group.rows.map((row) => (
                <div className={cn(ROW, "border-zinc-900 border-b")} key={row.label}>
                  <div className={cn(LABEL_CELL, "flex flex-col gap-1")}>
                    <div className="font-sans text-sm/4.5 text-zinc-200 tracking-[-0.01em]">
                      {row.label}
                    </div>
                    {row.detail ? (
                      <div className="max-w-[420px] font-sans text-xs/4 text-zinc-500 tracking-[-0.01em]">
                        {row.detail}
                      </div>
                    ) : null}
                  </div>
                  <div className={VALUE_CELL}>
                    <Cell value={row.free} />
                  </div>
                  <div className={VALUE_CELL}>
                    <Cell value={row.grow} />
                  </div>
                  <div className={VALUE_CELL}>
                    <Cell value={row.enterprise} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
