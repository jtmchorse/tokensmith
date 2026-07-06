// DTCG tokens.json loader.
//
// Walks the document tree: any object with a $value is a TOKEN; any other
// object is a GROUP and is recursed into. $type inherits downward from the
// nearest group that sets one. Fails loud with the offending path — a vague
// parse error in a tool meant to be read is a bug.

import { readFileSync } from "node:fs";
import {
  ALIAS_RE,
  type FlatToken,
  TokenParseError,
  type TokenSet,
  type TokenType,
} from "./types.js";

/** Keys that are DTCG metadata, not children. */
const DOLLAR = (k: string) => k.startsWith("$");

/** Group/token names may not contain the characters that break referencing. */
const ILLEGAL_NAME = /[{}.]/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

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

/** Parse an already-decoded DTCG document. */
export function parseTokens(doc: unknown, source = "<inline>"): TokenSet {
  if (!isPlainObject(doc)) {
    throw new TokenParseError("document root must be a JSON object", "", source);
  }
  const tokens = new Map<string, FlatToken>();
  walkGroup(doc, [], undefined, tokens, source);
  if (tokens.size === 0) {
    throw new TokenParseError("document contains no tokens", "", source);
  }
  return { tokens, tree: doc, source };
}

function walkGroup(
  group: Record<string, unknown>,
  path: string[],
  inheritedType: TokenType | undefined,
  out: Map<string, FlatToken>,
  source: string,
): void {
  // A group may set $type for everything beneath it.
  const groupType =
    typeof group.$type === "string" ? (group.$type as TokenType) : inheritedType;

  for (const [name, node] of Object.entries(group)) {
    if (DOLLAR(name)) continue; // group metadata, not a child

    const herePath = [...path, name];
    const here = herePath.join(".");

    if (ILLEGAL_NAME.test(name)) {
      throw new TokenParseError(
        `illegal character in name "${name}" (names may not contain "{", "}", or ".")`,
        here,
        source,
      );
    }
    if (!isPlainObject(node)) {
      throw new TokenParseError(
        `expected a token or group object, got ${node === null ? "null" : Array.isArray(node) ? "array" : typeof node}`,
        here,
        source,
      );
    }

    if ("$value" in node) {
      out.set(here, parseToken(here, node, groupType, source));
    } else {
      walkGroup(node, herePath, groupType, out, source);
    }
  }
}

function parseToken(
  path: string,
  node: Record<string, unknown>,
  inheritedType: TokenType | undefined,
  source: string,
): FlatToken {
  // A token is a leaf — child token/group keys alongside $value are malformed.
  for (const k of Object.keys(node)) {
    if (!DOLLAR(k)) {
      throw new TokenParseError(
        `token has non-$ child "${k}" — a token cannot also be a group`,
        path,
        source,
      );
    }
  }

  const raw = node.$value;
  const ownType =
    typeof node.$type === "string" ? (node.$type as TokenType) : undefined;
  const description =
    typeof node.$description === "string" ? node.$description : undefined;

  let isAlias = false;
  let aliasTarget: string | undefined;
  if (typeof raw === "string") {
    const m = ALIAS_RE.exec(raw);
    if (m) {
      isAlias = true;
      aliasTarget = m[1];
    }
  }

  const type = ownType ?? inheritedType;
  // Non-alias tokens must know their type (own or inherited); aliases may
  // defer to their target's type, which M2 resolution fills in.
  if (type === undefined && !isAlias) {
    throw new TokenParseError(
      `token has no $type and no ancestor group provides one`,
      path,
      source,
    );
  }

  return { path, type, raw, isAlias, aliasTarget, description };
}
