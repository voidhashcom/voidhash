import { ArrowUpRightIcon } from "lucide-react";

/**
 * Renders the one-line self-hosting note under the plan columns.
 *
 * Sits inside the plans section rather than its own one, so the free-forever alternative reads
 * as a footnote to the tiers rather than an unrelated pitch further down the page.
 */
export function PricingSelfHost() {
  return (
    <div className="flex flex-col gap-3 border-zinc-800 border-t px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10">
      <div className="font-sans text-[15px]/6 text-zinc-400 tracking-[-0.01em]">
        Voidhash is open source — you can also run the whole platform yourself, for free.
      </div>
      <a
        className="flex w-max items-center gap-1.5 font-sans text-[15px]/6 text-zinc-200 tracking-[-0.01em] transition-opacity hover:opacity-80"
        href="https://github.com/voidhashcom/voidhash/tree/main/selfhost"
        rel="noreferrer"
        target="_blank"
      >
        Self-hosting guide
        <ArrowUpRightIcon className="size-4 shrink-0" />
      </a>
    </div>
  );
}
