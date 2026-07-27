"use client";

import type { ComponentProps, ComponentType } from "react";
import * as LucideIcons from "lucide-react";
import { SquareIcon } from "lucide-react";

type IconPlaceholderProps = ComponentProps<"svg"> & {
  lucide: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
};

/**
 * Resolves the Lucide icon selected by the Voidhash design system.
 */
export function IconPlaceholder({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  ...props
}: IconPlaceholderProps) {
  const Icon = LucideIcons[lucide as keyof typeof LucideIcons] as
    | ComponentType<ComponentProps<"svg">>
    | undefined;

  return Icon ? <Icon {...props} /> : <SquareIcon {...props} />;
}
