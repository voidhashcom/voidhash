import type { IconName } from "@voidhash/paywalls/schema";
import { cn } from "@voidhash/ui";
import {
  AlertTriangleIcon,
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpCircleIcon,
  BetweenHorizontalStartIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CodeIcon,
  ComponentIcon,
  DiamondIcon,
  ExternalLinkIcon,
  EyeIcon,
  FlipHorizontalIcon,
  FullscreenIcon,
  ImageIcon,
  ImagePlusIcon,
  InfoIcon,
  MinusIcon,
  MousePointerIcon,
  PaintbrushIcon,
  PanelBottomDashedIcon,
  PanelLeftDashedIcon,
  PanelLeftRightDashedIcon,
  PanelRightDashedIcon,
  PanelTopBottomDashedIcon,
  PanelTopDashedIcon,
  PencilIcon,
  PercentIcon,
  PipetteIcon,
  PlusIcon,
  Redo2Icon,
  RotateCcwIcon,
  RotateCwIcon,
  SaveIcon,
  ScanIcon,
  SearchIcon,
  SettingsIcon,
  SquareDashedIcon,
  SquareDashedTopSolidIcon,
  SquareIcon,
  SquareRoundCornerIcon,
  TrashIcon,
  TypeIcon,
  Undo2Icon,
  UserIcon,
  UsersIcon,
  VaultIcon,
  XIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { createElement } from "react";

type LucideIcon = ComponentType<{ className?: string }>;

/**
 * The three panel letter glyphs (`w`, `h`, `a`) render as bold text spans, byte
 * for byte matching how the width/height/typography inputs draw them today
 * (`<div className="font-bold text-xs">W</div>`). The `className` from
 * {@link renderPanelIcon} overrides the sizing so callers keep control of scale.
 */
function letterGlyph(letter: string): (className?: string) => ReactNode {
  return (className) =>
    createElement("div", { className: cn("font-bold text-xs", className) }, letter);
}

/**
 * Registry of every {@link IconName} wire token → a renderer taking an optional
 * `className`. Lucide tokens render their component; letter tokens (`w`/`h`/`a`)
 * render the styled letter span; rotated/flipped variants apply the same
 * transform classes the sections use (`SquareRoundCorner` corners,
 * `SquareDashed` edges, `RotateCw`/`RotateCcw`/`FlipHorizontal`).
 */
export const PANEL_ICON_REGISTRY: Record<IconName, (className?: string) => ReactNode> = {
  // Letter glyphs (width / height / typography letter icons).
  w: letterGlyph("W"),
  h: letterGlyph("H"),
  a: letterGlyph("A"),

  // Plain lucide tokens.
  plus: (className) => createElement(PlusIcon as LucideIcon, { className }),
  minus: (className) => createElement(MinusIcon as LucideIcon, { className }),
  x: (className) => createElement(XIcon as LucideIcon, { className }),
  trash: (className) => createElement(TrashIcon as LucideIcon, { className }),
  pencil: (className) => createElement(PencilIcon as LucideIcon, { className }),
  search: (className) => createElement(SearchIcon as LucideIcon, { className }),
  settings: (className) => createElement(SettingsIcon as LucideIcon, { className }),
  info: (className) => createElement(InfoIcon as LucideIcon, { className }),
  alert: (className) => createElement(AlertTriangleIcon as LucideIcon, { className }),
  image: (className) => createElement(ImageIcon as LucideIcon, { className }),
  imagePlus: (className) => createElement(ImagePlusIcon as LucideIcon, { className }),
  pipette: (className) => createElement(PipetteIcon as LucideIcon, { className }),
  percent: (className) => createElement(PercentIcon as LucideIcon, { className }),
  diamond: (className) => createElement(DiamondIcon as LucideIcon, { className }),
  square: (className) => createElement(SquareIcon as LucideIcon, { className }),
  squareDashed: (className) => createElement(SquareDashedIcon as LucideIcon, { className }),
  squareRoundCorner: (className) =>
    createElement(SquareRoundCornerIcon as LucideIcon, { className }),
  // Rotated corner variants for the border-radius panel, byte-matching the
  // transform classes the legacy section applied per corner (top-right is the
  // plain `squareRoundCorner`).
  squareRoundCornerTopLeft: (className) =>
    createElement(SquareRoundCornerIcon as LucideIcon, { className: cn("-scale-x-100", className) }),
  squareRoundCornerBottomLeft: (className) =>
    createElement(SquareRoundCornerIcon as LucideIcon, { className: cn("rotate-180", className) }),
  squareRoundCornerBottomRight: (className) =>
    createElement(SquareRoundCornerIcon as LucideIcon, {
      className: cn("rotate-180 -scale-x-100", className),
    }),
  // Per-side border-width variants for the border panel; the base token is the
  // top edge (plain), the rest apply the section's per-side rotations.
  squareDashedTopSolid: (className) =>
    createElement(SquareDashedTopSolidIcon as LucideIcon, { className }),
  squareDashedTopSolidLeft: (className) =>
    createElement(SquareDashedTopSolidIcon as LucideIcon, { className: cn("-rotate-90", className) }),
  squareDashedTopSolidRight: (className) =>
    createElement(SquareDashedTopSolidIcon as LucideIcon, { className: cn("rotate-90", className) }),
  squareDashedTopSolidBottom: (className) =>
    createElement(SquareDashedTopSolidIcon as LucideIcon, { className: cn("rotate-180", className) }),
  type: (className) => createElement(TypeIcon as LucideIcon, { className }),
  component: (className) => createElement(ComponentIcon as LucideIcon, { className }),
  code: (className) => createElement(CodeIcon as LucideIcon, { className }),
  eye: (className) => createElement(EyeIcon as LucideIcon, { className }),
  paintbrush: (className) => createElement(PaintbrushIcon as LucideIcon, { className }),
  chevronDown: (className) => createElement(ChevronDownIcon as LucideIcon, { className }),
  chevronRight: (className) => createElement(ChevronRightIcon as LucideIcon, { className }),
  chevronUp: (className) => createElement(ChevronUpIcon as LucideIcon, { className }),
  arrowDown: (className) => createElement(ArrowDownIcon as LucideIcon, { className }),
  arrowRight: (className) => createElement(ArrowRightIcon as LucideIcon, { className }),
  arrowUpCircle: (className) => createElement(ArrowUpCircleIcon as LucideIcon, { className }),
  rotateCw: (className) => createElement(RotateCwIcon as LucideIcon, { className }),
  rotateCcw: (className) => createElement(RotateCcwIcon as LucideIcon, { className }),
  flipHorizontal: (className) => createElement(FlipHorizontalIcon as LucideIcon, { className }),
  undo: (className) => createElement(Undo2Icon as LucideIcon, { className }),
  redo: (className) => createElement(Redo2Icon as LucideIcon, { className }),
  save: (className) => createElement(SaveIcon as LucideIcon, { className }),
  fullscreen: (className) => createElement(FullscreenIcon as LucideIcon, { className }),
  scan: (className) => createElement(ScanIcon as LucideIcon, { className }),
  vault: (className) => createElement(VaultIcon as LucideIcon, { className }),
  panelLeftDashed: (className) => createElement(PanelLeftDashedIcon as LucideIcon, { className }),
  panelRightDashed: (className) =>
    createElement(PanelRightDashedIcon as LucideIcon, { className }),
  panelTopDashed: (className) => createElement(PanelTopDashedIcon as LucideIcon, { className }),
  panelBottomDashed: (className) =>
    createElement(PanelBottomDashedIcon as LucideIcon, { className }),
  // Uniform-padding axis glyphs (horizontal / vertical) and the layout-gap icon,
  // byte-matching the tokens the legacy flex-layout section drew for its
  // padding-horizontal / padding-vertical / gap inputs.
  panelLeftRightDashed: (className) =>
    createElement(PanelLeftRightDashedIcon as LucideIcon, { className }),
  panelTopBottomDashed: (className) =>
    createElement(PanelTopBottomDashedIcon as LucideIcon, { className }),
  betweenHorizontalStart: (className) =>
    createElement(BetweenHorizontalStartIcon as LucideIcon, { className }),
  user: (className) => createElement(UserIcon as LucideIcon, { className }),
  users: (className) => createElement(UsersIcon as LucideIcon, { className }),
  externalLink: (className) => createElement(ExternalLinkIcon as LucideIcon, { className }),
  mousePointer: (className) => createElement(MousePointerIcon as LucideIcon, { className }),
  alignLeft: (className) => createElement(AlignLeftIcon as LucideIcon, { className }),
  alignCenter: (className) => createElement(AlignCenterIcon as LucideIcon, { className }),
  alignRight: (className) => createElement(AlignRightIcon as LucideIcon, { className }),
};

/**
 * Renders a wire {@link IconName} token to a host icon element with an optional
 * `className`. Central icon seam for the panel-tree renderer: the wire carries
 * only the token; the host owns the actual element.
 */
export function renderPanelIcon(name: IconName, className?: string): ReactNode {
  return PANEL_ICON_REGISTRY[name](className);
}
