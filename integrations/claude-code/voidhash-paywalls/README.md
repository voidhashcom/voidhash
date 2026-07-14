# Voidhash paywalls for Claude Code

This plugin connects Claude Code to the hosted Voidhash paywall MCP server and adds a visually verified authoring workflow.

## Prerequisites

Install `voidhash-cli` and authenticate once:

```sh
voidhash-cli auth login
```

If the account can access multiple projects, set the project id or slug before starting Claude Code:

```sh
export VOIDHASH_PROJECT=my-project
```

The plugin obtains request headers from `voidhash-cli auth token` whenever the MCP connection starts. It does not require a separate API key in plugin configuration.

## Codex

Codex can connect to the same streamable HTTP endpoint directly. Put the user API key in an environment variable, then add this to `~/.codex/config.toml` or a trusted project's `.codex/config.toml`:

```toml
[mcp_servers.voidhash_paywalls]
url = "https://api.voidhash.com/api/mcp"
bearer_token_env_var = "VOIDHASH_MCP_TOKEN"
env_http_headers = { "X-Voidhash-Project" = "VOIDHASH_PROJECT" }
```

Set `VOIDHASH_MCP_TOKEN` to the authenticated user API key. Set `VOIDHASH_PROJECT` to a project id or slug when the account can access multiple projects; if it can access exactly one, the `env_http_headers` line may be omitted.
