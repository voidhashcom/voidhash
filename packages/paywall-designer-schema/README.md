# @voidhash/paywall-designer-schema

Schema package for the Voidhash paywall designer document format.

This package exports:

- `PaywallDesignerDocument`
- `PresenceSchema`
- node primitives and node-related types (`RootNode`, `ScreenNode`, `FlexNode`, `TextNode`, `ShapeNode`, `PathNode`)
- style, state, variable, and interaction schemas used by the designer

The schemas are built on top of `@voidhash/mimic` primitives and are intended for both clients (editor tooling, MCP) and servers (validation, persistence).
