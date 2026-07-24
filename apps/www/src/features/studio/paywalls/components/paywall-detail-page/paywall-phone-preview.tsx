"use client";

import { Link } from "@tanstack/react-router";
import type { Paywall } from "@voidhash/rpc";
import { Phone } from "@voidhash/ui";
import { ExternalLinkIcon, SmartphoneIcon } from "lucide-react";

interface PaywallPhonePreviewProps {
  organizationSlug: string;
  paywall: typeof Paywall.Type;
  projectSlug: string;
}

/**
 * Bare phone mockup of the paywall's latest rendered thumbnail — no card and no
 * backdrop, just the device floating in the page. The whole screen is a link
 * into the designer; hovering (or focusing) it blurs the thumbnail behind a
 * centred "Edit paywall" call to action.
 */
export function PaywallPhonePreview({
  organizationSlug,
  paywall,
  projectSlug,
}: PaywallPhonePreviewProps) {
  return (
    <Phone
      className="mx-auto w-full max-w-[300px]"
      screenClassName="flex items-center justify-center bg-zinc-950"
    >
      <Link
        className="group absolute inset-0 flex items-center justify-center outline-none"
        params={{ id: paywall.id, organizationSlug, projectSlug }}
        rel="noreferrer"
        target="_blank"
        to="/studio/$organizationSlug/$projectSlug/design/$id"
      >
        {paywall.thumbnailUrl ? (
          <img
            alt={paywall.name}
            className="size-full object-cover object-top"
            loading="lazy"
            src={paywall.thumbnailUrl}
          />
        ) : (
          <SmartphoneIcon className="size-10 text-zinc-400 opacity-30" />
        )}

        <span className="absolute inset-0 flex items-center justify-center rounded-[calc(15cqw_-_6px)] bg-black/20 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-focus-visible:opacity-100 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 hover:bg-white/90 px-4 py-2 font-medium text-black text-sm">
            Edit paywall
            <ExternalLinkIcon className="size-4" />
          </span>
        </span>
      </Link>
    </Phone>
  );
}
