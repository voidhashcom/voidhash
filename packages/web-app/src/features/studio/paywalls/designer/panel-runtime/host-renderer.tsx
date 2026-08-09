"use client";

/**
 * Renders a decoded, host-trusted {@link PanelTree} with real kit components.
 *
 * {@link PanelTreeView} subscribes to a {@link PanelTransport} via
 * `useSyncExternalStore` and renders its snapshot: `loading` → a skeleton,
 * `error` → the error chrome (message + optional Restart), `ready` → the
 * recursive {@link PanelNodeView} over the tree root.
 *
 * {@link PanelNodeView} is the wire→host bridge: it maps each node's `type` to a
 * kit component and adapts the validated wire props/events onto that component's
 * concrete signature. Event props are created ONLY for names present in
 * `node.events`; each dispatches back through `transport.dispatch(...)`. Every
 * string renders as React text — there is NO `dangerouslySetInnerHTML` anywhere,
 * and image URLs are scheme-allowlisted before they reach a DOM attribute.
 */
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@voidhash/ui";
import type { IconName } from "@voidhash/paywalls/schema";
import { RotateCwIcon } from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  ComponentBoundAction,
  VariableType,
  VariableTypeKey,
} from "@voidhash/mimic-schema";

import {
  PanelCallout,
  PanelColumn,
  PanelField,
  PanelRow,
  PanelText,
} from "../panel-kit/chrome";
import { ActionEditorField } from "../panel-kit/action-editor-field";
import { VariableBindingField } from "../panel-kit/variable-binding-field";
import { ProductInput } from "../components/variables/inputs/product-input";
import type {
  LabeledVariable,
  VariableInputValue,
} from "../components/variables/types";
import { FlexAlignmentInput } from "../panel-kit/alignment-grid";
import { ColorInput } from "../panel-kit/color-input";
import { ColorPickerContent } from "../panel-kit/color-picker/color-picker-content";
import { ColorSwatch } from "../panel-kit/color-picker/color-swatch";
import { rgbaToHexOpacity } from "../panel-kit/color-picker/color-utils";
import {
  DimensionFieldView,
  type DimensionAxis,
  type DimensionState,
} from "../panel-kit/dimension-field";
import { FillField } from "../panel-kit/fill-field";
import { nextStopPosition } from "../panels/right-panel/utils/gradient-stops";
import { GradientStopBar } from "../panel-kit/gradient-stop-bar";
import { ImageField } from "../panel-kit/image-field";
import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSectionTitle,
  PanelSubSection,
  PanelSubSectionContent,
  PanelSubSectionTitle,
} from "../panel-kit/panel-section";
import { OverrideResetAffordance } from "../panel-kit/reset-affordance";
import { SelectInput } from "../panel-kit/select-input";
import { TextInput } from "../panel-kit/text-input";
import type {
  BackgroundGradient,
  BackgroundImage,
  BackgroundType,
} from "../state/actions/features/fill-style-actions";
import { renderPanelIcon } from "./icon-registry";
import type { PanelGestureController } from "./gesture-controller";
import type { PanelNode } from "./schema";
import type { PanelTransport } from "./transport";

/**
 * Optional per-render seams the host supplies. `expandPropField` /
 * `expandDefaultProps` are provided by the component-panel slot in Phase 3 (a
 * `propField`/`defaultProps` node expands to the real host prop editor there);
 * when absent they render nothing (with a dev warning). `gestures` routes each
 * node's props through gesture-local echo.
 */
export interface PanelRenderContext {
  /** Expands a `propField` node to the host's real prop-row editor (Phase 3). */
  expandPropField?: (name: string) => ReactNode;
  /** Expands a `defaultProps` node to the host's manifest-driven prop rows (Phase 3). */
  expandDefaultProps?: (exclude: readonly string[]) => ReactNode;
  /** Gesture-local echo controller; freezes the active gesture node's value props. */
  gestures?: PanelGestureController;
}

const isDev = import.meta.env.DEV;

const devWarn = (message: string): void => {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn(`[panel-runtime] ${message}`);
  }
};

/**
 * Fallbacks for a `fillField` whose gradient/image props are absent or `null`.
 * The host `FillField` composite requires non-null `gradient`/`image`; a
 * definition that renders a solid fill still carries a placeholder gradient so
 * the gradient tab has something to show if the user switches to it.
 */
const EMPTY_GRADIENT: BackgroundGradient = {
  kind: "linear",
  startX: 0.5,
  startY: 0,
  endX: 0.5,
  endY: 1,
  stops: [
    { color: "rgba(255, 255, 255, 1)", position: 0 },
    { color: "rgba(255, 255, 255, 0)", position: 1 },
  ],
};
const EMPTY_IMAGE: BackgroundImage = { url: "", resizeMode: "cover" };

// =============================================================================
// Value helpers
// =============================================================================

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;
const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;
const asBool = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;
/**
 * Text form of a wire value for text-like controls. Only primitives have a
 * meaningful rendering; anything else (objects, arrays) becomes empty rather
 * than the useless `[object Object]`.
 */
const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value.toString();
  return "";
};
const asIcon = (value: unknown): IconName | undefined =>
  typeof value === "string" ? (value as IconName) : undefined;

/** Options passed to `selectField`/`toggleGroup`/`menu`. */
interface WireOption {
  value: string;
  label?: string;
  icon?: IconName;
  disabled?: boolean;
}

const asOptions = (value: unknown): WireOption[] =>
  Array.isArray(value) ? (value as WireOption[]) : [];

/**
 * Scheme allowlist for any URL that reaches a DOM attribute (image `src`, CSS
 * `url(...)`). Only `https:`, `blob:`, and `data:image/` are honored; anything
 * else (including `javascript:`) renders no image.
 */
const isAllowedImageUrl = (url: string): boolean => {
  if (url.startsWith("https:")) return true;
  if (url.startsWith("blob:")) return true;
  if (url.startsWith("data:image/")) return true;
  return false;
};

const safeImageUrl = (url: string | undefined): string | undefined =>
  url && isAllowedImageUrl(url) ? url : undefined;

/**
 * Builds a handler that dispatches `name` for `nodeId` — but ONLY if `name` is in
 * the node's event allowlist. Returns `undefined` otherwise, so the kit prop is
 * simply omitted (no dead handlers cross the boundary).
 */
const eventHandler = (
  transport: PanelTransport,
  node: PanelNode,
  name: string,
): ((...args: unknown[]) => void) | undefined => {
  if (!node.events.includes(name)) return undefined;
  return (...args: unknown[]) => {
    transport.dispatch({ nodeId: node.id, name, args });
  };
};

// =============================================================================
// Children
// =============================================================================

const renderChildren = (
  children: readonly PanelNode[] | undefined,
  transport: PanelTransport,
  ctx: PanelRenderContext,
): ReactNode =>
  children?.map((child) => (
    <PanelNodeView ctx={ctx} key={child.id} node={child} transport={transport} />
  ));

// =============================================================================
// Per-type adapters
// =============================================================================

/** The gradient stop shape the wire carries (id-keyed). */
interface WireGradientStop {
  id: number;
  position: number;
  color: string;
}

const renderNode = (
  node: PanelNode,
  props: { readonly [key: string]: unknown },
  transport: PanelTransport,
  ctx: PanelRenderContext,
): ReactNode => {
  const children = renderChildren(node.children, transport, ctx);

  switch (node.type) {
    // ── Chrome / layout ──────────────────────────────────────────────────────
    case "panel":
      return <>{children}</>;

    case "section": {
      const onToggle = eventHandler(transport, node, "onToggle");
      // A `sectionActions` child renders in the section HEADER (a per-section
      // affordance like the fill/stroke enable +/− button), mirroring the legacy
      // sections' `PanelSectionHeaderActions`. It is hoisted out of the content
      // flow so the remaining children stay in the body; when a section carries
      // both an `onToggle` toggle and `sectionActions`, both render in the header.
      const actionsChild = node.children?.find((child) => child.type === "sectionActions");
      const bodyNodes = node.children?.filter((child) => child.type !== "sectionActions") ?? [];
      const bodyChildren = renderChildren(bodyNodes, transport, ctx);
      const headerActions = actionsChild
        ? renderChildren(actionsChild.children, transport, ctx)
        : null;
      const hasHeader =
        asString(props.title) !== undefined ||
        node.events.includes("onToggle") ||
        actionsChild !== undefined;
      return (
        <PanelSection>
          {hasHeader && (
            <PanelSectionHeader>
              <PanelSectionTitle>{asString(props.title) ?? ""}</PanelSectionTitle>
              {(onToggle || headerActions) && (
                <PanelSectionHeaderActions>
                  {onToggle && (
                    <Button
                      onClick={() => onToggle(!(asBool(props.defaultCollapsed) ?? false))}
                      size="icon-sm"
                      variant="ghost"
                    >
                      {renderPanelIcon("chevronDown", "size-3.5")}
                    </Button>
                  )}
                  {headerActions}
                </PanelSectionHeaderActions>
              )}
            </PanelSectionHeader>
          )}
          {/* Skip the content container entirely when every child was hoisted to
              the header (a section whose only child is `sectionActions`) — the
              legacy sections gate their `PanelSectionContent` on having body
              content, so an empty div would add ~16px of dead vertical space. */}
          {bodyNodes.length > 0 && <PanelSectionContent>{bodyChildren}</PanelSectionContent>}
        </PanelSection>
      );
    }

    // A top-level (non-section-header) `sectionActions` still renders its own
    // header-actions row; inside a `section` it is hoisted into the header above.
    case "sectionActions":
      return <PanelSectionHeaderActions>{children}</PanelSectionHeaderActions>;

    case "subsection":
      return (
        <PanelSubSection>
          {asString(props.title) !== undefined && (
            <PanelSubSectionTitle>{asString(props.title)}</PanelSubSectionTitle>
          )}
          <PanelSubSectionContent>{children}</PanelSubSectionContent>
        </PanelSubSection>
      );

    case "row":
      return (
        <PanelRow
          align={asString(props.align) as never}
          justify={asString(props.justify) as never}
        >
          {children}
        </PanelRow>
      );

    case "column":
      return <PanelColumn align={asString(props.align) as never}>{children}</PanelColumn>;

    case "field":
      return (
        <PanelField
          icon={props.icon ? renderPanelIcon(asIcon(props.icon)!, "size-3.5") : undefined}
          label={asString(props.label) ?? ""}
        >
          {children}
        </PanelField>
      );

    case "text":
      return (
        <PanelText
          content={asString(props.content) ?? ""}
          tone={asString(props.tone) === "muted" ? "muted" : "default"}
          variant={asString(props.variant) === "label" ? "label" : "body"}
        />
      );

    case "callout": {
      const tone = asString(props.tone);
      return (
        <PanelCallout
          message={asString(props.message) ?? ""}
          tone={tone === "warning" ? "warning" : tone === "error" ? "danger" : "info"}
        />
      );
    }

    // ── Popover (composed Radix) ───────────────────────────────────────────────
    case "popover": {
      const onOpenChange = eventHandler(transport, node, "onOpenChange");
      const open = asBool(props.open);
      return (
        <Popover
          onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
          open={open}
        >
          {children}
        </Popover>
      );
    }

    case "popoverTrigger":
      return <PopoverTrigger asChild>{children}</PopoverTrigger>;

    case "popoverContent":
      return (
        <PopoverContent
          align={(asString(props.align) as "start" | "center" | "end" | undefined) ?? "start"}
          side={asString(props.side) as never}
        >
          {children}
        </PopoverContent>
      );

    // ── Menu (composed Radix DropdownMenu) ─────────────────────────────────────
    case "menu": {
      const onSelect = eventHandler(transport, node, "onSelect");
      const items = asOptions(props.items);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost">
              {renderPanelIcon("chevronDown", "size-3.5")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={(asString(props.align) as "start" | "center" | "end" | undefined) ?? "end"}
          >
            {items.map((item) => (
              <DropdownMenuItem
                disabled={item.disabled}
                key={item.value}
                onSelect={() => onSelect?.(item.value)}
              >
                {item.icon ? renderPanelIcon(item.icon, "mr-2 size-3.5") : null}
                {item.label ?? item.value}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // ── Controls ───────────────────────────────────────────────────────────────
    case "textField": {
      const onChange = eventHandler(transport, node, "onChange");
      const onCommit = eventHandler(transport, node, "onCommit");
      const onTrailingSelect = eventHandler(transport, node, "onTrailingSelect");
      const value = asText(props.value);
      const trailingMenu = props.trailingMenu as
        | { items: WireOption[]; value?: string }
        | undefined;
      return (
        <TextInput
          disabled={asBool(props.disabled)}
          icon={props.icon ? renderPanelIcon(asIcon(props.icon)!, "size-3.5") : undefined}
          label={asString(props.placeholder) ?? "Value"}
          maxValue={asNumber(props.max)}
          minValue={asNumber(props.min)}
          mixed={asBool(props.mixed)}
          onChange={onChange ? (next) => onChange(next) : () => {}}
          onCommit={onCommit ? () => onCommit(value) : undefined}
          type={asString(props.kind) === "number" ? "number" : "text"}
          typeNumberStepIncrement={asNumber(props.step) ?? 1}
          trailing={
            trailingMenu && onTrailingSelect ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    {renderPanelIcon("chevronDown", "size-3.5")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {trailingMenu.items.map((item) => (
                    <DropdownMenuItem
                      key={item.value}
                      onSelect={() => onTrailingSelect(item.value)}
                    >
                      {item.label ?? item.value}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined
          }
          value={value}
        />
      );
    }

    case "selectField": {
      const onChange = eventHandler(transport, node, "onChange");
      const options = asOptions(props.options).map((o) => ({
        label: o.label ?? o.value,
        value: o.value,
      }));
      return (
        <SelectInput
          disabled={asBool(props.disabled)}
          label={asString(props.placeholder) ?? "Select"}
          mixed={asBool(props.mixed)}
          onChange={onChange ? (next) => onChange(next) : () => {}}
          options={options}
          placeholder={asString(props.placeholder)}
          value={asString(props.value) ?? ""}
        />
      );
    }

    case "toggleGroup": {
      const onChange = eventHandler(transport, node, "onChange");
      const options = asOptions(props.options);
      const mixed = asBool(props.mixed);
      return (
        // The group sizes to its content (`w-fit`, the kit default) — the legacy
        // sections NEVER set `w-full` on the group itself. A fillRule group sitting
        // in a `justify-between` row must stay content-sized so the row's `−`
        // button keeps its gap; block-level groups (stroke cap/join, text align)
        // fill their container regardless. Items keep `flex-1` to divide the width
        // evenly WHEN the group is stretched by its parent, byte-matching the old
        // segmented-control markup.
        <ToggleGroup
          disabled={asBool(props.disabled)}
          onValueChange={onChange ? (next) => next && onChange(next) : undefined}
          size="sm"
          type="single"
          value={mixed ? "" : (asString(props.value) ?? "")}
        >
          {/* Items stretch to equal width (`flex-1`), matching every designer
              toggle group's segmented-control layout. */}
          {options.map((option) => (
            <ToggleGroupItem className="flex-1" key={option.value} size="sm" value={option.value}>
              {option.icon ? renderPanelIcon(option.icon, "size-3.5") : (option.label ?? option.value)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
    }

    case "switchField": {
      const onChange = eventHandler(transport, node, "onChange");
      return (
        <Switch
          checked={asBool(props.checked) ?? false}
          disabled={asBool(props.disabled)}
          onCheckedChange={onChange ? (next) => onChange(next) : undefined}
        />
      );
    }

    case "button": {
      const onClick = eventHandler(transport, node, "onClick");
      return (
        <Button
          disabled={asBool(props.disabled)}
          onClick={onClick ? () => onClick() : undefined}
          size={(asString(props.size) as never) ?? "sm"}
          variant={(asString(props.variant) as never) ?? "outline"}
        >
          {props.icon ? renderPanelIcon(asIcon(props.icon)!, "size-3.5") : null}
          {asString(props.label)}
        </Button>
      );
    }

    case "sliderField": {
      const onChange = eventHandler(transport, node, "onChange");
      const onCommit = eventHandler(transport, node, "onCommit");
      const value = asNumber(props.value) ?? 0;
      return (
        <Slider
          disabled={asBool(props.disabled)}
          max={asNumber(props.max) ?? 100}
          min={asNumber(props.min) ?? 0}
          onValueChange={onChange ? ([next]) => next !== undefined && onChange(next) : undefined}
          onValueCommit={onCommit ? ([next]) => next !== undefined && onCommit(next) : undefined}
          step={asNumber(props.step) ?? 1}
          value={[value]}
        />
      );
    }

    case "resetAffordance": {
      const onReset = eventHandler(transport, node, "onReset");
      return (
        <OverrideResetAffordance
          label={asString(props.label) ?? "value"}
          onReset={onReset ? () => onReset() : () => {}}
          show={asBool(props.show) ?? false}
        >
          {children}
        </OverrideResetAffordance>
      );
    }

    // ── Composites ───────────────────────────────────────────────────────────
    case "colorField": {
      const onChange = eventHandler(transport, node, "onChange");
      const onDragStart = eventHandler(transport, node, "onDragStart");
      const onCommit = eventHandler(transport, node, "onCommit");
      const onDiscard = eventHandler(transport, node, "onDiscard");
      const value = asString(props.value) ?? "";
      return (
        <ColorInput
          mixed={asBool(props.mixed)}
          mixedLabel={asString(props.mixedLabel)}
          onChange={onChange ? (next) => onChange(next) : () => {}}
          onCommit={onCommit ? () => onCommit(value) : undefined}
          onDiscard={onDiscard ? () => onDiscard() : undefined}
          onDragStart={onDragStart ? () => onDragStart() : undefined}
          value={value}
        />
      );
    }

    case "colorPicker": {
      const onColorChange = eventHandler(transport, node, "onColorChange");
      const onOpacityChange = eventHandler(transport, node, "onOpacityChange");
      const onDragStart = eventHandler(transport, node, "onDragStart");
      const onDragEnd = eventHandler(transport, node, "onDragEnd");
      const onDiscard = eventHandler(transport, node, "onDiscard");
      return (
        <ColorPickerContent
          color={asString(props.color) ?? "000000"}
          onColorChange={onColorChange ? (next) => onColorChange(next) : () => {}}
          onDiscard={onDiscard ? () => onDiscard() : undefined}
          onDragEnd={onDragEnd ? () => onDragEnd() : undefined}
          onDragStart={onDragStart ? () => onDragStart() : undefined}
          onOpacityChange={onOpacityChange ? (next) => onOpacityChange(next) : () => {}}
          opacity={asNumber(props.opacity) ?? 100}
        />
      );
    }

    case "gradientStops": {
      const onSelect = eventHandler(transport, node, "onSelect");
      const onMoveStop = eventHandler(transport, node, "onMoveStop");
      const onAddStop = eventHandler(transport, node, "onAddStop");
      const onDragStart = eventHandler(transport, node, "onDragStart");
      const onDragEnd = eventHandler(transport, node, "onDragEnd");
      const onDiscard = eventHandler(transport, node, "onDiscard");
      const wireStops = (props.stops as WireGradientStop[] | undefined) ?? [];
      // Map id-keyed wire stops ↔ the component's index-based shape; translate
      // index callbacks back to ids on dispatch.
      const barStops = wireStops.map((stop) => ({ color: stop.color, position: stop.position }));
      const selectedStopId = props.selectedStopId as number | null | undefined;
      const selectedIndex =
        selectedStopId == null
          ? null
          : (() => {
              const idx = wireStops.findIndex((stop) => stop.id === selectedStopId);
              return idx === -1 ? null : idx;
            })();
      const idAt = (index: number): number | undefined => wireStops[index]?.id;
      return (
        <GradientStopBar
          onAddStop={onAddStop ? (position) => onAddStop(position) : () => {}}
          onDiscard={onDiscard ? () => onDiscard() : undefined}
          onDragEnd={onDragEnd ? () => onDragEnd() : undefined}
          onDragStart={onDragStart ? () => onDragStart() : undefined}
          onPositionChange={(index, position) => {
            const id = idAt(index);
            if (id !== undefined) onMoveStop?.(id, position);
          }}
          onSelect={(index) => {
            const id = idAt(index);
            if (id !== undefined) onSelect?.(id);
          }}
          selectedIndex={selectedIndex}
          stops={barStops}
        />
      );
    }

    case "swatch": {
      const imageUrl = safeImageUrl(asString(props.imageUrl) ?? undefined);
      if (imageUrl) {
        return (
          <span className="relative block size-5 shrink-0 overflow-hidden rounded-[3px]">
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              src={imageUrl}
            />
          </span>
        );
      }
      const { hex, opacity } = rgbaToHexOpacity(asString(props.color) ?? "rgba(0,0,0,1)");
      return <ColorSwatch color={hex} opacity={opacity} />;
    }

    case "imageField": {
      const onPick = eventHandler(transport, node, "onPick");
      const onResizeModeChange = eventHandler(transport, node, "onResizeModeChange");
      const onClear = eventHandler(transport, node, "onClear");
      return (
        <ImageField
          onClear={onClear ? () => onClear() : undefined}
          onPick={onPick ? (url) => onPick(url) : undefined}
          onResizeModeChange={
            onResizeModeChange ? (mode) => onResizeModeChange(mode) : undefined
          }
          resizeMode={asString(props.resizeMode) as never}
          url={safeImageUrl(asString(props.url) ?? undefined)}
        />
      );
    }

    case "alignmentGrid": {
      const onChange = eventHandler(transport, node, "onChange");
      // The host grid emits `{ alignItems, justifyContent }`; the definition
      // writes both keys DIRECT (one undo). `mixed` is carried by the wire but the
      // grid renders from the effective values (a mixed multi-selection still
      // highlights the shared cell if any).
      return (
        <FlexAlignmentInput
          alignItems={(asString(props.alignItems) as never) ?? "stretch"}
          flexDirection={(asString(props.flexDirection) as never) ?? "row"}
          justifyContent={(asString(props.justifyContent) as never) ?? "flex-start"}
          onChange={
            onChange ? (value) => onChange(value as unknown) : () => {}
          }
        />
      );
    }

    case "dimensionField": {
      const onChange = eventHandler(transport, node, "onChange");
      const onCommit = eventHandler(transport, node, "onCommit");
      const onModeChange = eventHandler(transport, node, "onModeChange");
      const axis = (asString(props.axis) as DimensionAxis | undefined) ?? "width";
      const mode = (asString(props.mode) as DimensionState | undefined) ?? "custom";
      const value = asNumber(props.value) ?? 0;
      const computed = asNumber(props.computed) ?? null;
      return (
        <DimensionFieldView
          axis={axis}
          computed={computed}
          disabled={asBool(props.disabled)}
          label={asString(props.label) ?? (axis === "width" ? "Width" : "Height")}
          mixed={asBool(props.mixed)}
          mode={mode}
          onChange={onChange ? (next) => onChange(next) : () => {}}
          onCommit={onCommit ? () => onCommit(value) : undefined}
          onModeChange={onModeChange ? (next) => onModeChange(next) : () => {}}
          value={value}
        />
      );
    }

    case "fillField":
      // The composite is stateful (popover open + selected gradient stop) and its
      // granular stop callbacks are consolidated into whole-gradient writes, so it
      // renders through a dedicated host-local view rather than inline here. See
      // {@link FillFieldNodeView} for the wire-event partition rationale.
      return <FillFieldNodeView node={node} props={props} transport={transport} />;

    case "variableField":
      // The variable binding editor is an app-context composite (it reaches the
      // shared VariableInput/VariableBindingField); its host-local view reduces
      // the composite's single `onChange` into the wire node's `onBind`/`onUnbind`
      // intents (a variable-reference binds, a literal unbinds).
      return <VariableFieldNodeView node={node} props={props} transport={transport} />;

    case "actionEditorField":
      // The action editor needs the selection-scoped variable lists carried in the
      // wire props (variables/productVariables/payloadFields); it renders through a
      // host-local view over the shared ActionEditor.
      return <ActionEditorFieldNodeView node={node} props={props} transport={transport} />;

    case "productField":
      // A literal product-value editor: the ProductInput combobox owns its own
      // products react-query, so it renders through a host-local view that adapts
      // the wire `productId`/`onChange(productId)` surface onto it.
      return <ProductFieldNodeView node={node} props={props} transport={transport} />;

    // ── Component-panel slot seams (Phase 3) ───────────────────────────────────
    case "propField": {
      const name = asString(props.name) ?? "";
      if (ctx.expandPropField) return <>{ctx.expandPropField(name)}</>;
      devWarn(`propField "${name}" rendered without an expandPropField seam`);
      return null;
    }

    case "defaultProps": {
      const exclude = Array.isArray(props.exclude) ? (props.exclude as string[]) : [];
      if (ctx.expandDefaultProps) return <>{ctx.expandDefaultProps(exclude)}</>;
      devWarn("defaultProps rendered without an expandDefaultProps seam");
      return null;
    }

    default:
      devWarn(`no renderer for node type "${node.type}"`);
      return null;
  }
};

// =============================================================================
// fillField view
// =============================================================================

const rebuildStops = (stops: readonly { color: string; position: number }[]) =>
  stops.map((stop) => ({ color: stop.color, position: stop.position }));

/**
 * Host-local view for a `fillField` node.
 *
 * The `fillField` composite exposes 15 event callbacks, but `PANEL_CAPS.
 * eventsPerNode` is 8. Only the WRITE-bearing events cross the wire; the two
 * pure-UI concerns — the editor popover's open state and the selected gradient
 * stop — are held HOST-LOCAL here (a definition never persists them, so they
 * never need to reach the store). The wire node therefore carries exactly these
 * eight events:
 *
 *   onTypeChange, onColorChange, onGradientChange,
 *   onImageUrlChange, onImageResizeModeChange,
 *   onGestureStart, onCommit, onDiscard
 *
 * The composite's granular gradient-stop callbacks (`onStopColorChange`,
 * `onStopPositionChange`, `onAddStop`, `onAddStopAt`, `onRemoveStop`) are
 * CONSOLIDATED here: each rebuilds the entire stops array from the current
 * gradient and dispatches ONE whole-gradient `onGradientChange` — the same
 * whole-object write the legacy fill-section performed, just moved to the host
 * boundary so the wire stays within the event cap. The `≤2` remove guard and the
 * add-then-select selection update live here too, matching the old section.
 */
function FillFieldNodeView({
  node,
  props,
  transport,
}: {
  node: PanelNode;
  props: { readonly [key: string]: unknown };
  transport: PanelTransport;
}): ReactNode {
  const onTypeChange = eventHandler(transport, node, "onTypeChange");
  const onColorChange = eventHandler(transport, node, "onColorChange");
  const onGradientChange = eventHandler(transport, node, "onGradientChange");
  const onImageUrlChange = eventHandler(transport, node, "onImageUrlChange");
  const onImageResizeModeChange = eventHandler(transport, node, "onImageResizeModeChange");
  const onGestureStart = eventHandler(transport, node, "onGestureStart");
  const onCommit = eventHandler(transport, node, "onCommit");
  const onDiscard = eventHandler(transport, node, "onDiscard");

  const gradient = (props.gradient as BackgroundGradient | null | undefined) ?? EMPTY_GRADIENT;
  const image = (props.image as BackgroundImage | null | undefined) ?? EMPTY_IMAGE;
  const backgroundType = (asString(props.backgroundType) as BackgroundType) ?? "solid";

  const [open, setOpen] = useState(false);
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(0);

  const stopCount = gradient.stops.length;
  // Keep the selected stop index within bounds as stops are added/removed —
  // verbatim from the legacy fill-section's clamping effect.
  useEffect(() => {
    setSelectedStopIndex((prev) => {
      if (stopCount === 0) return null;
      if (prev === null) return 0;
      return Math.min(prev, stopCount - 1);
    });
  }, [stopCount]);

  const writeGradient = useCallback(
    (next: BackgroundGradient) => {
      onGradientChange?.(next);
    },
    [onGradientChange],
  );

  const handleStopColor = useCallback(
    (index: number, color: string) => {
      const stops = gradient.stops.map((stop, i) => (i === index ? { ...stop, color } : stop));
      writeGradient({ ...gradient, stops: rebuildStops(stops) });
    },
    [gradient, writeGradient],
  );

  const handleStopPosition = useCallback(
    (index: number, position: number) => {
      const clamped = Math.min(1, Math.max(0, position));
      const stops = gradient.stops.map((stop, i) =>
        i === index ? { ...stop, position: clamped } : stop,
      );
      writeGradient({ ...gradient, stops: rebuildStops(stops) });
    },
    [gradient, writeGradient],
  );

  const handleAddStop = useCallback(() => {
    const position = nextStopPosition(gradient.stops);
    const lastColor = gradient.stops.at(-1)?.color ?? "rgba(255, 255, 255, 1)";
    const stops = [...gradient.stops, { color: lastColor, position }].sort(
      (a, b) => a.position - b.position,
    );
    writeGradient({ ...gradient, stops: rebuildStops(stops) });
    setSelectedStopIndex(stops.findIndex((s) => s.position === position && s.color === lastColor));
  }, [gradient, writeGradient]);

  const handleAddStopAt = useCallback(
    (position: number, color: string) => {
      const clamped = Math.min(1, Math.max(0, position));
      const stops = [...gradient.stops, { color, position: clamped }].sort(
        (a, b) => a.position - b.position,
      );
      writeGradient({ ...gradient, stops: rebuildStops(stops) });
      setSelectedStopIndex(stops.findIndex((s) => s.position === clamped && s.color === color));
    },
    [gradient, writeGradient],
  );

  const handleRemoveStop = useCallback(
    (index: number) => {
      if (gradient.stops.length <= 2) return;
      const stops = gradient.stops.filter((_, i) => i !== index);
      writeGradient({ ...gradient, stops: rebuildStops(stops) });
    },
    [gradient, writeGradient],
  );

  return (
    <FillField
      backgroundColor={asString(props.backgroundColor) ?? "rgba(0, 0, 0, 1)"}
      backgroundType={backgroundType}
      gradient={gradient}
      image={image}
      isTypeMixed={asBool(props.isTypeMixed) ?? false}
      label={asString(props.label) ?? ""}
      onAddStop={handleAddStop}
      onAddStopAt={handleAddStopAt}
      onColorChange={onColorChange ? (color) => onColorChange(color) : () => {}}
      onCommit={onCommit ? () => onCommit() : () => {}}
      onDiscard={onDiscard ? () => onDiscard() : () => {}}
      onGestureStart={onGestureStart ? () => onGestureStart() : () => {}}
      onGradientChange={writeGradient}
      onImageResizeModeChange={
        onImageResizeModeChange ? (mode) => onImageResizeModeChange(mode) : () => {}
      }
      onImageUrlChange={onImageUrlChange ? (url) => onImageUrlChange(url) : () => {}}
      onOpenChange={setOpen}
      onRemoveStop={handleRemoveStop}
      onSelectStop={setSelectedStopIndex}
      onStopColorChange={handleStopColor}
      onStopPositionChange={handleStopPosition}
      onTypeChange={onTypeChange ? (type) => onTypeChange(type) : () => {}}
      open={open}
      selectedStopIndex={selectedStopIndex}
    />
  );
}

// =============================================================================
// variableField / actionEditorField / productField views
// =============================================================================

/** Coerces a wire prop into a `LabeledVariable[]` (already validated by the gate). */
const asLabeledVariables = (value: unknown): LabeledVariable[] =>
  Array.isArray(value) ? (value as LabeledVariable[]) : [];

/**
 * Host-local view for a `variableField` node.
 *
 * The wire node carries the currently-bound variable as flat props
 * (`variableId`/`variableName`/`variableType`) plus `allowedKinds`, and the host
 * composite {@link VariableBindingField} works over the shared VariableInput. The
 * composite emits a single `onChange(VariableInputValue)`; this view REDUCES that
 * to the wire node's addressable intents — a `variable-reference` result binds
 * (`onBind` with the id), a `literal` result unbinds (`onUnbind`) — mirroring the
 * wire contract's "host VariableInput collapses to one onChange" note. The
 * available-variable list is not carried on this node (a single bound variable is
 * reconstructed from the flat props), so the reference dropdown shows the bound
 * variable only.
 */
function VariableFieldNodeView({
  node,
  props,
  transport,
}: {
  node: PanelNode;
  props: { readonly [key: string]: unknown };
  transport: PanelTransport;
}): ReactNode {
  const onBind = eventHandler(transport, node, "onBind");
  const onUnbind = eventHandler(transport, node, "onUnbind");

  const variableId = asString(props.variableId);
  const variableName = asString(props.variableName) ?? "";
  const variableType = (asString(props.variableType) as VariableTypeKey | undefined) ?? "string";
  const allowedKinds = Array.isArray(props.allowedKinds)
    ? (props.allowedKinds as string[])
    : [];
  const expectedType = (allowedKinds[0] as VariableTypeKey | undefined) ?? undefined;

  // Reconstruct the bound variable (if any) so the reference option renders with
  // its name; the empty default literal seeds the literal editor otherwise.
  const boundVariable: LabeledVariable | undefined = variableId
    ? { id: variableId, name: variableName, value: { key: variableType, value: emptyLiteral(variableType).value } as VariableType }
    : undefined;
  const variables = boundVariable ? [boundVariable] : [];
  const value: VariableInputValue = variableId
    ? { type: "variable-reference", value: { id: variableId } }
    : { type: "literal", value: emptyLiteral(variableType) };

  return (
    <VariableBindingField
      expectedType={expectedType}
      label={asString(props.label) ?? "Value"}
      onChange={(next) => {
        if (next.type === "variable-reference") {
          onBind?.((next.value as { id: string }).id);
        } else {
          onUnbind?.();
        }
      }}
      value={value}
      variables={variables}
    />
  );
}

/** A zeroed literal for a variable type key (matches the type registry defaults). */
function emptyLiteral(key: VariableTypeKey): VariableType {
  switch (key) {
    case "boolean":
      return { key: "boolean", value: false };
    case "number":
      return { key: "number", value: 0 };
    case "product":
      return { key: "product", value: {} };
    case "string":
      return { key: "string", value: "" };
  }
}

/**
 * Host-local view for an `actionEditorField` node.
 *
 * The action editor is an app-context composite that requires the
 * selection-scoped variable lists — carried on the wire node as serializable
 * `variables` / `productVariables` and the optional `payloadFields`. This view
 * feeds them (and the plain-JSON `value` action) to the shared
 * {@link ActionEditorField}; `onChange` dispatches the whole edited action back.
 */
function ActionEditorFieldNodeView({
  node,
  props,
  transport,
}: {
  node: PanelNode;
  props: { readonly [key: string]: unknown };
  transport: PanelTransport;
}): ReactNode {
  const onChange = eventHandler(transport, node, "onChange");
  const value = (props.value ?? { type: "none" }) as ComponentBoundAction;
  const variables = asLabeledVariables(props.variables);
  const productVariables = asLabeledVariables(props.productVariables);
  const payloadFields = Array.isArray(props.payloadFields)
    ? (props.payloadFields as string[])
    : undefined;
  return (
    <ActionEditorField
      onChange={onChange ? (action) => onChange(action) : () => {}}
      payloadFields={payloadFields}
      productVariables={productVariables}
      value={value}
      variables={variables}
    />
  );
}

/**
 * Host-local view for a `productField` node.
 *
 * The {@link ProductInput} combobox owns its own products react-query (resolving
 * the org's products), so it can't be a pure wire prop mapping. This view adapts
 * the wire `productId` / `onChange(productId)` surface onto it: a picked product
 * dispatches its id (or `""` when cleared).
 */
function ProductFieldNodeView({
  node,
  props,
  transport,
}: {
  node: PanelNode;
  props: { readonly [key: string]: unknown };
  transport: PanelTransport;
}): ReactNode {
  const onChange = eventHandler(transport, node, "onChange");
  const productId = asString(props.productId) ?? null;
  return (
    <ProductInput
      onChange={(next) => onChange?.(next.productId ?? "")}
      value={{ productId }}
    />
  );
}

// =============================================================================
// Node view
// =============================================================================

/**
 * Renders one panel node. `key={node.id}` is set by the PARENT (in
 * {@link renderChildren} / {@link PanelTreeView}), so identity is stable across
 * re-emits. Props are routed through the gesture controller's echo filter (a
 * no-op unless a gesture is active on this node).
 */
export function PanelNodeView({
  node,
  transport,
  ctx,
}: {
  node: PanelNode;
  transport: PanelTransport;
  ctx: PanelRenderContext;
}): ReactNode {
  const props = ctx.gestures ? ctx.gestures.filterNodeProps(node) : node.props;
  return <Fragment>{renderNode(node, props, transport, ctx)}</Fragment>;
}

// =============================================================================
// Tree view
// =============================================================================

/** A neutral loading skeleton shown before the first tree emits. */
function PanelSkeleton(): ReactNode {
  return (
    <div className="flex flex-col gap-2 px-4 py-3" aria-busy="true">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-7 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

/** The error chrome: a message and — when restartable — a Restart button. */
function PanelErrorChrome({
  message,
  restartable,
  onRestart,
}: {
  message: string;
  restartable: boolean;
  onRestart: () => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-2 border-border border-b px-4 py-3">
      <p className="text-destructive text-xs">{message}</p>
      {restartable && (
        <Button className="self-start" onClick={onRestart} size="sm" variant="outline">
          <RotateCwIcon className="size-3.5" />
          Restart
        </Button>
      )}
    </div>
  );
}

/**
 * Subscribes to a {@link PanelTransport} and renders its current snapshot. This
 * is the single entry point the host mounts per panel session.
 */
export function PanelTreeView({
  transport,
  renderContext,
}: {
  transport: PanelTransport;
  renderContext?: PanelRenderContext;
}): ReactNode {
  const subscribe = useCallback((cb: () => void) => transport.subscribe(cb), [transport]);
  const getSnapshot = useCallback(() => transport.getSnapshot(), [transport]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ctx = useMemo<PanelRenderContext>(() => renderContext ?? {}, [renderContext]);

  if (snapshot.status === "loading") {
    return <PanelSkeleton />;
  }
  if (snapshot.status === "error") {
    return (
      <PanelErrorChrome
        message={snapshot.message}
        onRestart={() => transport.restart()}
        restartable={snapshot.restartable}
      />
    );
  }
  return <PanelNodeView ctx={ctx} node={snapshot.tree.root} transport={transport} />;
}
