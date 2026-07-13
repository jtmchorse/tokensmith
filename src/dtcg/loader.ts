// DTCG tokens.json loader — the filesystem entry point.
//
// The actual tree-walk lives in parse.ts (pure, browser-safe). This module
// only adds the disk read, then delegates. parseTokens is re-exported so
// existing importers (and tests) can keep pulling it from "./loader.js".

import { readFileSync } from "node:fs";
import { parseTokens } from "./parse.js";
import { TokenParseError, type TokenSet } from "./types.js";

export { parseTokens } from "./parse.js";

/** Load and parse a tokens.json file from disk. */
export function loadTokensFile(filePath: string): TokenSet {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (e) {
    throw new TokenParseError(
      `cannot read file: ${(e as Error).message}`,
      "",
      filePath,
    );
  }
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new TokenParseError(
      `invalid JSON: ${(e as Error).message}`,
      "",
      filePath,
    );
  }
  return parseTokens(doc, filePath);
}
