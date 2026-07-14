# Voidhash paywalls for Claude Code

This plugin connects Claude Code to the hosted Voidhash paywall MCP server and adds a visually verified authoring workflow.

Authentication uses OAuth in the browser. The plugin does not require `voidhash-cli`, an API key, or environment variables.

## Test from this checkout

Start Claude Code with the local plugin:

```sh
claude --plugin-dir ./integrations/claude-code/voidhash-paywalls
```

Open `/mcp`, approve the `voidhash-paywalls` server if prompted, and choose **Authenticate**. You can also run `claude mcp login voidhash-paywalls`. Complete sign-in and organization selection in the browser.

For this browser-only flow, test with an organization that contains one project. The server rejects ambiguous multi-project organizations instead of guessing which project an agent may edit.

Then ask Claude:

> Use Voidhash Paywalls to list my paywalls, open one for editing, render a preview, and revert the edit without publishing changes.
