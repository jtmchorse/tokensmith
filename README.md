# tokensmith

> Make coding agents **design-system-aware**. An MCP server that gives any agent (Claude Code, Claude Desktop, Cursor) first-class access to a design system's tokens, so generated UI comes out on-system and token-correct the first time.

**Status:** `v0.0` — M0 ✅ (skeleton + stdio pipe proven via raw JSON-RPC handshake) · M1 ✅ (DTCG loader) · M2 ✅ (alias resolver) · next **M3** (wire the MCP tools). Private until v0.1. This README is the **build spec**: an agent should be able to bring the current milestone to "done" from this file alone.

---

## M1 ✅ — DTCG loader (`src/dtcg/`)

- `types.ts` — DTCG model: `FlatToken` (dot-path, `$type` own-or-inherited, raw `$value`, alias detection), `TokenSet`, path-annotated `TokenParseError`, `ALIAS_RE`.
- `loader.ts` — `loadTokensFile(path)` / `parseTokens(doc)`: walks groups (`$value` ⇒ token, else group), inherits `$type` downward, flattens to `Map<path, FlatToken>`. **Detects aliases, does not resolve them** — resolution incl. chains + cycle guard is M2's tested core. Fails loud with the offending path.
- `examples/tokens.json` — "Meridian", an invented clean-room demo system: 62 tokens, 21 aliases, chains up to 3 deep (`color.action.primary → color.brand.primary → color.base.blue-600`) so resolution demos show something real. **Modes (light/dark) deliberately deferred past v0.0.**
- Tests: `npm test` (vitest) — 15 cases across the example system + error paths.

## M2 ✅ — alias resolver (`src/dtcg/resolver.ts`)

- `resolveToken(set, path)` → `Resolution { path, value, type, chain, description }` — terminal value + the full walk (`chain.length === 1` ⇒ literal). Typeless aliases adopt the first defined `$type` along the chain; an alias's own type wins.
- `resolveAll(set)` — every token, document order; what M3's `list_tokens` serves.
- Failures are `TokenResolveError` with the walked chain in the message: unknown path (with a nearest-miss "did you mean" hint on case slips / unique leaves), broken reference, and cycles (visited-set guard; self-reference, 2-node, and entered-mid-chain loops all covered).
- Scope note: whole-`$value` aliases only; embedded references inside composite values are v0.1+.
- Tests: 34 across loader + resolver.

## M3 — next: wire `list_tokens` + `resolve_token` MCP tools

Replace `ping` as the story: `list_tokens(group?)` → resolved token listing (path, type, value, isAlias) optionally filtered by group prefix; `resolve_token(name)` → value + type + the alias chain (the demo moment). Server loads the token file at startup — `TOKENS_PATH` env var or CLI arg, default `examples/tokens.json` — and fails loud on a bad file. Errors from the resolver surface as MCP tool errors with their messages intact. `ping` stays.

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
