import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// M0 walking skeleton: a stdio MCP server exposing exactly one `ping` tool.
// THE RULE: stdout is the JSON-RPC channel. All diagnostics go to stderr.
const server = new McpServer({ name: "tokensmith", version: "0.0.0" });

server.registerTool(
  "ping",
  { title: "Ping", description: "Health check", inputSchema: {} },
  async () => ({ content: [{ type: "text", text: "pong" }] })
);

const transport = new StdioServerTransport();
await server.connect(transport);

// stderr only — a single stdout write would corrupt the protocol stream.
console.error("tokensmith MCP server (v0.0.0) listening on stdio");
