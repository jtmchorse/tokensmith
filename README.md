# tokensmith

> Make coding agents **design-system-aware**. An MCP server that gives any agent (Claude Code, Claude Desktop, Cursor) first-class access to a design system's tokens, so generated UI comes out on-system and token-correct the first time.

**Status:** `v0.0` — M0 walking skeleton. Private until v0.1. This README is the **build spec**: an agent should be able to bring M0 to "done" from this file alone.

---

## Why it exists
Today an agent writing UI guesses at color, spacing, and type — it has no idea your design system exists. tokensmith is the bridge: expose a design system (W3C Design Tokens / DTCG `tokens.json`) over MCP so agents *query* the system instead of guessing. Full vision (read / resolve / generate-with-system / audit / round-trip-to-Figma) lives in the spec; **M0 proves only the pipe.**

---

## M0 — the only goal of this milestone
Stand up a **stdio MCP server** named `tokensmith` that exposes exactly one trivial tool, `ping`, and verify a real Claude client can call it. No token logic yet — M0 de-risks the one true unknown (does a client discover and talk to this process over stdio).

### Build it
1. Node 20+, TypeScript, ESM (`"type": "module"`).
2. Deps: `@modelcontextprotocol/sdk`, `zod`. Dev: `typescript`, `tsx`.
3. Lay out:
   ```
   src/index.ts        # the server: register `ping`, wire stdio, connect
   tsconfig.json       # nodenext module resolution, outDir dist/
   package.json        # "build": "tsc", bin -> dist/index.js
   ```
4. `npm run build` → `dist/index.js`.

### `ping` contract
- name: `ping`, description: "Health check", no input.
- returns text content `"pong"`.

### Reference server shape
> ⚠️ **Verify against the installed SDK version** — the `@modelcontextprotocol/sdk` API has shifted across releases. Check the installed package's actual exports before trusting this snippet; adapt method/import names as needed.
```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "tokensmith", version: "0.0.0" });

server.registerTool(
  "ping",
  { title: "Ping", description: "Health check", inputSchema: {} },
  async () => ({ content: [{ type: "text", text: "pong" }] })
);

await server.connect(new StdioServerTransport());
```

### 🚨 The one rule that breaks everything
On a stdio MCP server, **stdout IS the JSON-RPC channel**. A single `console.log` to stdout corrupts the stream and the client silently fails to connect. **All logging goes to stderr** (`console.error`). If it "won't connect for no reason," this is suspect #1.

---

## Verify (the ladder — fastest first)
1. **Starts:** `node dist/index.js` runs and *hangs* (correct — waiting on stdio, not exiting).
2. **MCP Inspector:** `npx @modelcontextprotocol/inspector node dist/index.js` → open the local URL → call `ping` → `pong`. This is the dev loop.
3. **Claude Code:** `claude mcp add tokensmith -s project -- node <abs>/dist/index.js`, restart, confirm `ping` is listed and returns `pong`.
4. **Claude Desktop:** add to `~/Library/Application Support/Claude/claude_desktop_config.json`, then **fully quit and reopen** Desktop:
   ```json
   { "mcpServers": { "tokensmith": { "command": "node", "args": ["<abs>/dist/index.js"] } } }
   ```

## M0 done-bar
`pong` returns on the Inspector **and** at least one real Claude client. Commit + push. Then M1 (DTCG loader) begins.

## Explicitly OUT of scope for M0
No token parsing, no `tokens.json`, no `list_tokens`/`resolve_token`, no Figma. Just the pipe.
