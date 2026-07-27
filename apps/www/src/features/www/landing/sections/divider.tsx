/** Renders the hairline band that separates two landing page sections. */
export function LandingDivider() {
  return (
    <div className="flex flex-col items-center gap-2.5 self-stretch border-zinc-800 border-b py-2.5">
      <div className="flex h-3 shrink-0 items-center self-stretch border-zinc-800 border-t border-b" />
    </div>
  );
}
