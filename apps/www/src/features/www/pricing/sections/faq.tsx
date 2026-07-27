import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@voidhash/ui";

import { LandingSection, SectionHeader } from "@/features/www/landing/shared";

import { FAQ } from "../plans";

/** Renders the pricing FAQ. */
export function PricingFaq() {
  return (
    <LandingSection>
      <div className="flex flex-col gap-12 px-6 py-16 md:px-12 md:py-24 lg:flex-row lg:gap-24 xl:p-32">
        <div className="w-full lg:w-90 lg:shrink-0">
          <SectionHeader eyebrow="Questions" title="The things people ask us first." />
        </div>
        <Accordion className="min-w-0 flex-1 border-zinc-800 border-t" collapsible type="single">
          {FAQ.map((entry) => (
            <AccordionItem
              className="border-zinc-800 last:border-b"
              key={entry.question}
              value={entry.question}
            >
              <AccordionTrigger className="py-5 font-medium font-sans text-[17px]/6 text-white tracking-[-0.02em] hover:no-underline">
                {entry.question}
              </AccordionTrigger>
              <AccordionContent className="max-w-[720px] pb-5 font-sans text-[15px]/6.5 text-zinc-400 tracking-[-0.01em]">
                {entry.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </LandingSection>
  );
}
