// Browser entry for the live demo page. Bundles the REAL audit core (the same
// dist/ code the MCP server and tests use) with the Meridian example tokens
// inlined, so the page audits in-browser with zero backend.
//
// Build (from repo root):
//   node_modules/.bin/esbuild demo/web/src/entry.mjs --bundle --format=iife \
//     --global-name=Tokensmith --minify --outfile=demo/web/audit.bundle.js

import { parseTokens } from "../../../dist/dtcg/parse.js";
import { resolveAll } from "../../../dist/dtcg/resolver.js";
import { auditCss } from "../../../dist/audit/audit.js";
import tokens from "../../../examples/tokens.json";

const set = parseTokens(tokens, "meridian");

/** Audit a chunk of code. Same signature as the MCP audit_css tool. */
export function audit(code, opts) {
  return auditCss(set, code, opts);
}

/** Resolved token list (for the swatch legend, if the page wants it). */
export function tokenList() {
  return [...resolveAll(set).values()].map((r) => ({
    path: r.path,
    type: r.type,
    value: r.value,
  }));
}

export const tokenCount = set.tokens.size;
