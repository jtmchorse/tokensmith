// DTCG (W3C Design Tokens Community Group) format types.
// Spec: https://design-tokens.github.io/community-group/format/
//
// M1 scope: represent tokens as-written. Aliases are DETECTED here but not
// resolved — resolution (chains + cycle guard) is M2's tested core.
// Modes (light/dark) are deliberately out of v0.0 scope.

/**
 * Token types the DTCG spec names today. The loader accepts unknown strings
 * too (the vocabulary is still evolving) — these are the ones we type.
 */
export const KNOWN_TOKEN_TYPES = [
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "string",
  "shadow",
  "typography",
  "border",
  "transition",
  "gradient",
  "strokeStyle",
] as const;

export type KnownTokenType = (typeof KNOWN_TOKEN_TYPES)[number];

/** A token's $type: a known DTCG type, or a forward-compatible string. */
export type TokenType = KnownTokenType | (string & {});

/** A single token, flattened out of the tree with its dot-joined path. */
export interface FlatToken {
  /** Dot-joined path, e.g. "color.action.primary". */
  path: string;
  /**
   * $type — own, or inherited from the nearest ancestor group that sets one.
   * May be undefined for an alias token (its type comes from the target,
   * which M2 resolution supplies).
   */
  type: TokenType | undefined;
  /** The raw $value exactly as written in the file. */
  raw: unknown;
  /** True when $value is an alias reference like "{color.brand.primary}". */
  isAlias: boolean;
  /** The referenced path (without braces) when isAlias is true. */
  aliasTarget?: string;
  /** $description, if present. */
  description?: string;
}

/** The loaded token set: flat map (the working surface) + the raw tree. */
export interface TokenSet {
  /** Token path -> FlatToken. Iteration order = document order. */
  tokens: Map<string, FlatToken>;
  /** The raw parsed document, untouched (useful for debugging / M3+). */
  tree: Record<string, unknown>;
  /** Where this set came from (file path or "<inline>"). */
  source: string;
}

/** Loud, path-annotated parse failure. Error quality is part of the product. */
export class TokenParseError extends Error {
  constructor(
    message: string,
    /** Dot-joined location in the document where parsing failed. */
    public readonly path: string,
    /** File (or "<inline>") being parsed. */
    public readonly source: string,
  ) {
    super(`${source}${path ? ` at "${path}"` : ""}: ${message}`);
    this.name = "TokenParseError";
  }
}

/** Matches a DTCG alias $value: the WHOLE string is "{group.path.to.token}". */
export const ALIAS_RE = /^\{([^{}]+)\}$/;
