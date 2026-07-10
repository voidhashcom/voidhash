import type { ReactNode } from "react";

export interface PhoneFrameProps {
  children: ReactNode;
}

/**
 * A 9:16 device mock. The screen fills the available height, keeps the phone
 * aspect ratio, and clips its content so a paywall renders exactly as it would
 * on a real device. The paywall owns the full screen via `absolute inset-0`.
 */
export const PhoneFrame = ({ children }: PhoneFrameProps): ReactNode => (
  <div className="flex h-full w-full items-center justify-center p-6">
    <div
      className="relative aspect-[9/16] h-full max-h-full overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-950 bg-white shadow-2xl ring-1 ring-neutral-800"
      style={{ maxWidth: "100%" }}
    >
      {/* Notch */}
      <div className="-translate-x-1/2 pointer-events-none absolute top-0 left-1/2 z-10 h-6 w-32 rounded-b-2xl bg-neutral-950" />
      {/* Screen — the paywall mounts here */}
      <div className="absolute inset-0 flex flex-col bg-white text-black">{children}</div>
      {/* Home indicator */}
      <div className="-translate-x-1/2 pointer-events-none absolute bottom-1.5 left-1/2 z-10 h-1 w-28 rounded-full bg-neutral-900/30" />
    </div>
  </div>
);
