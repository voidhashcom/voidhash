# voidhash-mcp-server

Local MCP server for Voidhash

## What it does

This server exposes tools for AI agents to:

- create and list paywalls
- connect to one active paywall designer websocket session
- mutate paywall document nodes (add/update/remove/move)
- set styles and text content
- snapshot current designer state
- list paywall locations (read-only)

## Auth and config

The server reads `~/.voidhash` and requires:

- `api_url`
- `api_key`

`api_key` is sent as `x-api-key` header for `/api/v1` calls.

If config is missing or invalid, server startup fails with a structured `CONFIG_ERROR`/`AUTH_ERROR`.

## Run locally

From the monorepo root:

```bash
pnpm --filter voidhash-mcp-server start
```

Build binary:

```bash
pnpm --filter voidhash-mcp-server build
```

## MCP client config examples

### Codex

```json
{
  "mcpServers": {
    "voidhash": {
      "command": "pnpm",
      "args": [
        "--filter",
        "voidhash-mcp-server",
        "start"
      ],
      "cwd": "/absolute/path/to/voidhash"
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "voidhash": {
      "command": "pnpm",
      "args": [
        "--filter",
        "voidhash-mcp-server",
        "start"
      ],
      "cwd": "/absolute/path/to/voidhash"
    }
  }
}
```

## Exposed tools

- `paywall_create`
- `paywall_list`
- `paywall_designer_connect`
- `paywall_designer_disconnect`
- `paywall_designer_snapshot`
- `paywall_designer_add_node`
- `paywall_designer_update_node`
- `paywall_designer_remove_node`
- `paywall_designer_move_node`
- `paywall_designer_set_style`
- `paywall_designer_set_text`
- `paywall_location_list`
