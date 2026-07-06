// Alias resolution — M2's tested core. Everything the MCP tools (M3) serve
// flows through resolveToken, so failures here must be loud, located, and
// carry the full chain that led to them.
//
// Scope (v0.0): a token's WHOLE $value may be an alias ("{path.to.token}").
// Embedded references inside composite values (e.g. a shadow object whose
// color property is an alias) are a documented v0.1+ extension.

import {
  type FlatToken,
  type TokenSet,
  type TokenType,
} from "./types.js";

/** The result of resolving one token to its terminal value. */
export interface Resolution {
  /** The path that was asked for. */
  path: string;
  /** The terminal, computed $value (never an alias string). */
  value: unknown;
  /** Effective $type — own if set, else adopted from the first typed token along the chain. */
  type: TokenType;
  /**
   * The full walk, starting at the requested token and ending at the
   * terminal literal, e.g. ["color.action.primary", "color.brand.primary",
   * "color.base.blue-600"]. Length 1 means the token was a literal.
   */
  chain: string[];
  /** The requested token's own $description (not the target's). */
  description?: string;
}

/** Resolution failure carrying the chain walked so far. */
export class TokenResolveError extends Error {
  constructor(
    message: string,
    /** Paths visited before the failure, in walk order. */
    public readonly chain: string[],
    public readonly source: string,
  ) {
    super(
      `${source}: ${message}${chain.length > 1 ? ` (chain: ${chain.join(" -> ")})` : ""}`,
    );
    this.name = "TokenResolveError";
  }
}

/** Resolve one token by path to its terminal value, chain, and type. */
export function resolveToken(set: TokenSet, path: string): Resolution {
  const start = lookup(set, path, []);
  const chain: string[] = [start.path];
  const visited = new Set<string>([start.path]);

  let current: FlatToken = start;
  let type: TokenType | undefined = start.type;

  while (current.isAlias) {
    const targetPath = current.aliasTarget!;
    if (visited.has(targetPath)) {
      throw new TokenResolveError(
        `alias cycle detected`,
        [...chain, targetPath],
        set.source,
      );
    }
    const target = lookup(set, targetPath, chain);
    chain.push(target.path);
    visited.add(target.path);
    type ??= target.type; // adopt the first defined type along the walk
    current = target;
  }

  // current is now the terminal literal. A literal always has a type
  // (the loader enforces it), so `type` is defined by here — but keep the
  // check honest rather than asserting.
  type ??= current.type;
  if (type === undefined) {
    throw new TokenResolveError(
      `no $type anywhere along the chain`,
      chain,
      set.source,
    );
  }

  return {
    path: start.path,
    value: current.raw,
    type,
    chain,
    description: start.description,
  };
}

/** Resolve every token in the set. Iteration order = document order. */
export function resolveAll(set: TokenSet): Map<string, Resolution> {
  const out = new Map<string, Resolution>();
  for (const path of set.tokens.keys()) {
    out.set(path, resolveToken(set, path));
  }
  return out;
}

function lookup(set: TokenSet, path: string, chain: string[]): FlatToken {
  const token = set.tokens.get(path);
  if (token) return token;

  const hint = suggest(set, path);
  throw new TokenResolveError(
    chain.length === 0
      ? `unknown token "${path}"${hint}`
      : `alias points at unknown token "${path}"${hint}`,
    [...chain, path],
    set.source,
  );
}

/** Cheap nearest-miss hint: case-insensitive exact, then unique suffix match. */
function suggest(set: TokenSet, missing: string): string {
  const lower = missing.toLowerCase();
  const caseHit = [...set.tokens.keys()].find((k) => k.toLowerCase() === lower);
  if (caseHit) return ` — did you mean "${caseHit}"?`;

  const leaf = missing.split(".").pop()!.toLowerCase();
  const suffixHits = [...set.tokens.keys()].filter((k) =>
    k.toLowerCase().endsWith(`.${leaf}`),
  );
  if (suffixHits.length === 1) return ` — did you mean "${suffixHits[0]}"?`;
  return "";
}
