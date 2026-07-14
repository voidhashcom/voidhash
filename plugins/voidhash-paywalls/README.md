# Voidhash paywalls for Codex

This plugin connects Codex to the hosted Voidhash paywall MCP server and adds a visually verified authoring workflow. Authentication uses OAuth in the browser; no CLI login, API key, or environment variable is required.

## Install from this checkout

From the repository root:

```sh
codex plugin marketplace add .
codex plugin add voidhash-paywalls@voidhash
```

The plugin is also available in the Codex app's plugin directory when this repository is open. Choose the **Voidhash** marketplace and install **Voidhash Paywalls**.

## Authenticate and test

After installation, use the MCP authentication action in Codex. In the CLI, run `codex mcp list`, then pass the listed Voidhash server name to `codex mcp login`. A browser opens so you can sign in and choose the organization to authorize.

For this browser-only flow, test with an organization that contains one project. The server rejects ambiguous multi-project organizations instead of guessing which project an agent may edit.

Start a new task and ask:

> Use Voidhash Paywalls to list my paywalls, open one for editing, render a preview, and revert the edit without publishing changes.
