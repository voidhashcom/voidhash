import {
  BlocksIcon,
  Columns2Icon,
  ComponentIcon,
  GalleryVerticalIcon,
  type LucideIcon,
  PentagonIcon,
  Rows2Icon,
  Smartphone,
  SplineIcon,
  SquareDashedIcon,
  TypeIcon,
} from "lucide-react";

/**
 * Icon keys shared by the layers tree and the add-component browser. Most map
 * 1:1 to a node type; `column`/`row` are the two visual variants the layers
 * tree derives for a `view` from its flex direction.
 */
export type NodeIconKey =
  | "column"
  | "component"
  | "path"
  | "root"
  | "row"
  | "screen"
  | "scrollView"
  | "shape"
  | "text"
  | "view";

/**
 * Shared node-type → icon map: the single source for the layers tree glyphs
 * and the Primitives group of the add-component browser. `root` carries no
 * glyph.
 */
export const NODE_TYPE_ICONS: Record<NodeIconKey, LucideIcon | null> = {
  column: Rows2Icon,
  component: ComponentIcon,
  path: SplineIcon,
  root: null,
  row: Columns2Icon,
  screen: Smartphone,
  scrollView: GalleryVerticalIcon,
  shape: PentagonIcon,
  text: TypeIcon,
  view: SquareDashedIcon,
};

/**
 * Icon for built-in component browser entries. Builtin definitions carry no
 * icon field, so the browser uses one shared default that reads distinctly
 * from the catalog/local component glyph.
 */
export const BUILTIN_COMPONENT_ICON: LucideIcon = BlocksIcon;
