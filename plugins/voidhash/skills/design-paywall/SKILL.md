---
name: design-paywall
description: Design, edit, preview, visually review, finish, or revert a Voidhash paywall through the Voidhash MCP server.
---

# Design a Voidhash paywall

Use the `voidhash` MCP server for all paywall operations.

Before editing:

1. Read `voidhash://paywall-authoring/reference` for the schema-derived authoring rules.
2. Call `list_paywalls`, then `begin_paywall_edit` for the selected slug.
3. Keep the returned `changeSetId` and pass it to every mutation and preview call.
4. Read the current structure with `get_paywall` and available catalog, local, and builtin components with `get_components`.
5. If the user provides an inspiration URL and browser tools are available, inspect it for visual context before editing. Browser context is optional and must never block the MCP workflow.

While editing:

- Prefer `edit_paywall` for visual composition and atomic batches.
- Use `duplicate_subtree` when an existing section is the right starting point.
- Use local component tools only when custom TSX behavior is genuinely needed. A write is not committed unless server-side compilation succeeds.
- After meaningful sections, call `get_paywall_preview` and inspect the returned image for hierarchy, spacing, clipping, legibility, and viewport fit.

Before stopping:

1. Render a final full preview and inspect the actual image.
2. Fix every visible issue and render again after the last mutation.
3. Call `finish_paywall_edit` with the exact latest `documentSignature`, a concise visual verdict, and an empty `unresolvedIssues` list.
4. If the result should be discarded, call `revert_paywall_edit` instead. Never abandon an active change set.
