import type { ReactNode } from "react";

import type { PreviewDeviceProfile } from "../voidhash/preview-devices";

export interface PhoneFrameProps {
  children: ReactNode;
  profile: PreviewDeviceProfile;
}

/**
 * A device mock sized to a preview profile. The screen fills the available
 * height, keeps the profile aspect ratio, and clips its paywall content.
 */
export const PhoneFrame = ({ children, profile }: PhoneFrameProps): ReactNode => (
  <div className="flex h-full w-full items-center justify-center p-6">
    <div
      className="relative h-full max-h-full overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-950 bg-white shadow-2xl ring-1 ring-neutral-800"
      style={{
        aspectRatio: `${profile.dimensions.window.width} / ${profile.dimensions.window.height}`,
        maxWidth: "100%",
      }}
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
