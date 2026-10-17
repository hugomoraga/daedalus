# Optional web research with Parallel

For a steward-authorized research session before a spec or ADR, [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp) gives OpenCode web search and page fetching without a Parallel account or API key. Anonymous search uses Fast mode; free access is intended for exploration and light use.

This is a setup reference, not adoption or authorization of a new tool. Follow [AGENTS.md's research guidance](../AGENTS.md#research-tools) and the [Constitution](../memory/constitution.md) before enabling it. The existing `/last30days` tool and paid-key approval requirements still apply. Research informs proposals; it does not authorize implementation or override the canon.

## Configure a research session

Use an installed [OpenCode](https://opencode.ai/docs/) client from your [session worktree](agent-orchestration.md). Save this JSON outside the repository, for example as `/tmp/daedalus-parallel-research.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "parallel_search": {
      "type": "remote",
      "url": "https://search.parallel.ai/mcp",
      "oauth": false,
      "timeout": 30000,
      "headers": {
        "User-Agent": "Daedalus/parallel-research"
      }
    }
  }
}
```

OpenCode [merges custom configuration](https://opencode.ai/docs/config/#custom-path) with its usual global and project configuration. This file adds only the named MCP connection; keep the repository's `opencode.json` intact. If you already use `OPENCODE_CONFIG`, add the `mcp.parallel_search` entry to that file instead of replacing your custom settings. Respect any existing disabled-search choice or connection with the same name.

Check the connection:

```bash
OPENCODE_CONFIG=/tmp/daedalus-parallel-research.json opencode mcp list
```

Look for `parallel_search` with a connected status. A failed status means the connection is not ready, even if the command exits successfully. Check the URL and network access; do not add credentials to work around a free-tier limit. See [OpenCode's remote MCP settings](https://opencode.ai/docs/mcp-servers/#remote) for configuration details.

Start OpenCode with the same configuration:

```bash
OPENCODE_CONFIG=/tmp/daedalus-parallel-research.json opencode
```

The client exposes the server's `web_search` and `web_fetch` tools under the `parallel_search` prefix. `web_search` finds current sources; `web_fetch` reads specific URLs. Keep research queries and fetched URLs public, without tenant data or secrets.

## Example: evidence for a future persistence ADR

After the steward authorizes this research task and tool, ask:

```text
Research current Node.js documentation on append-only file durability and
SQLite documentation on WAL durability for a possible future persistence ADR.
Use parallel_search to search primary sources, then fetch the two most relevant
pages. Return each URL, access date, relevant excerpt, and what it supports.
Separate source facts from recommendations and list unresolved questions.
Do not modify the canon, specs, runtime configuration, or tenant data.
```

Carry the relevant source URLs and findings into the proposed spec or ADR for human review. This research does not change Daedalus's current JSONL persistence or its spec approval gates.

To stop adding this connection, start OpenCode without the custom path. If you added the entry to an existing custom file, set its `enabled` field to `false` to disable it. The repository's shared configuration and runtime dependencies are unchanged.
