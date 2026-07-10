import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { loadTokensFile } from "./dtcg/loader.js";
import { resolveAll, resolveToken, TokenResolveError } from "./dtcg/resolver.js";
import { TokenParseError } from "./dtcg/types.js";
import { auditCss } from "./audit/audit.js";

// tokensmith — make coding agents design-system-aware.
// M3: the server now serves a real design system. Token file comes from
// argv[2] or TOKENS_PATH, defaulting to the bundled Meridian example.
// THE RULE: stdout is the JSON-RPC channel. All diagnostics go to stderr.

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TOKENS = join(PKG_ROOT, "examples", "tokens.json");

const tokensPath = resolve(
  process.argv[2] ?? process.env.TOKENS_PATH ?? DEFAULT_TOKENS,
);

let set;
try {
  set = loadTokensFile(tokensPath);
} catch (e) {
  // Startup failure is a configuration problem — die loud, never half-serve.
  console.error(
    `tokensmith: failed to load tokens: ${(e as Error).message}`,
  );
  process.exit(1);
}

const server = new McpServer({ name: "tokensmith", version: "0.1.0" });

/** Uniform happy-path shape: JSON text content. */
const jsonContent = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

/** Resolver/parse failures become MCP tool errors with their messages intact. */
const errorContent = (e: unknown) => ({
  content: [
    {
      type: "text" as const,
      text:
        e instanceof TokenResolveError || e instanceof TokenParseError
          ? e.message
          : `unexpected error: ${(e as Error).message}`,
    },
  ],
  isError: true,
});

server.registerTool(
  "ping",
  { title: "Ping", description: "Health check", inputSchema: {} },
  async () => ({ content: [{ type: "text", text: "pong" }] }),
);

server.registerTool(
  "list_tokens",
  {
    title: "List design tokens",
    description:
      "List the design system's tokens with their RESOLVED values. " +
      "Optionally filter by a group prefix (e.g. \"color\", \"color.action\", \"space\"). " +
      "Use these tokens instead of guessing values when writing UI code.",
    inputSchema: {
      group: z
        .string()
        .optional()
        .describe('Group prefix filter, e.g. "color.action" or "space".'),
    },
  },
  async ({ group }) => {
    try {
      const all = resolveAll(set);
      const prefix = group ? `${group}.` : null;
      const rows = [...all.values()]
        .filter((r) => !prefix || r.path === group || r.path.startsWith(prefix))
        .map((r) => ({
          path: r.path,
          type: r.type,
          value: r.value,
          aliasOf: r.chain.length > 1 ? r.chain[1] : undefined,
          description: r.description,
        }));
      if (group && rows.length === 0) {
        return errorContent(
          new Error(
            `no tokens under group "${group}" — try list_tokens with no filter to see the tree`,
          ),
        );
      }
      return jsonContent({ count: rows.length, tokens: rows });
    } catch (e) {
      return errorContent(e);
    }
  },
);

server.registerTool(
  "resolve_token",
  {
    title: "Resolve one design token",
    description:
      "Resolve a token by path (e.g. \"color.action.primary\") to its computed value, " +
      "effective type, and the full alias chain it resolves through.",
    inputSchema: {
      name: z
        .string()
        .describe('Token path, e.g. "color.action.primary".'),
    },
  },
  async ({ name }) => {
    try {
      const r = resolveToken(set, name);
      return jsonContent({
        path: r.path,
        value: r.value,
        type: r.type,
        chain: r.chain,
        isAlias: r.chain.length > 1,
        description: r.description,
      });
    } catch (e) {
      return errorContent(e);
    }
  },
);

server.registerTool(
  "audit_css",
  {
    title: "Audit code for off-system values",
    description:
      "Scan a chunk of CSS (or JSX with inline style props) for literal color and " +
      "dimension values that SHOULD be design tokens. Returns each finding with a " +
      "severity — exact-miss (the literal equals a token value), near-miss (it is " +
      "close to one), or no-match (off-system, nothing close) — and the nearest " +
      "token to use instead. This is how you VERIFY generated UI is on-system, " +
      "not just look tokens up.",
    inputSchema: {
      code: z
        .string()
        .describe("The source to scan — CSS, or JSX with inline style props."),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe(
          "Near-miss color-distance cutoff, 0..1 (default 0.12). Lower = stricter.",
        ),
      kinds: z
        .array(z.enum(["color", "dimension"]))
        .optional()
        .describe('Which literal kinds to scan. Default: both.'),
    },
  },
  async ({ code, threshold, kinds }) => {
    try {
      return jsonContent(auditCss(set, code, { threshold, kinds }));
    } catch (e) {
      return errorContent(e);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

// stderr only — a single stdout write would corrupt the protocol stream.
console.error(
  `tokensmith MCP server (v0.1.0) — serving ${set.tokens.size} tokens from ${tokensPath}`,
);
