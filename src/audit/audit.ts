// audit_css — scan code for literal values that should be design tokens.
//
// This is the guess->verify half of tokensmith. list_tokens / resolve_token
// make the design system AVAILABLE to an agent; audit_css catches the code that
// ignored it — the raw hex an agent reaches for when it never read the tokens.
//
// v0.1 scope, deliberately:
//   - COLORS report all three severities: exact-miss (literal equals a token
//     value), near-miss (within a tunable distance of one), and no-match (an
//     off-system color with nothing close — surfaced, not suggested).
//   - DIMENSIONS report exact-miss only. A raw "13px" is too often a legitimate
//     one-off to flag as drift, but a "16px" typed inline when space.4 IS 16px
//     is worth catching. Dimension near-miss is a v0.2 call.
//   - Scanning is regex-based (hex, rgb()/rgba(), <number>px/rem/em). Unitless
//     JSX numbers (borderRadius: 12) are NOT scanned — an AST pass is v0.2.

import { resolveAll, type Resolution } from "../dtcg/resolver.js";
import type { TokenSet, TokenType } from "../dtcg/types.js";
import { canonicalHex, colorDistance, parseColor, type RGB } from "./color.js";

export type Severity = "exact-miss" | "near-miss" | "no-match";

export interface AuditSuggestion {
  /** The token to use instead — the most SEMANTIC match by ranking. */
  path: string;
  /** That token's resolved value. */
  value: unknown;
  type: TokenType;
  /** Normalized color distance to the literal; 0 for an exact match. */
  distance: number;
  /** The token's alias chain (as resolve_token would report it). */
  chain: string[];
  /** Other token paths that resolve to the same value, if any. */
  alternatives?: string[];
}

export interface AuditFinding {
  /** The literal exactly as it appears in the source. */
  value: string;
  /** Canonical comparison form (e.g. "#2563eb", "16px"). */
  normalized: string;
  kind: "color" | "dimension";
  /** 1-based line and column of the literal. */
  line: number;
  column: number;
  severity: Severity;
  suggestion: AuditSuggestion | null;
}

export interface AuditReport {
  summary: {
    scanned: number;
    findings: number;
    exactMiss: number;
    nearMiss: number;
    noMatch: number;
  };
  findings: AuditFinding[];
}

export interface AuditOptions {
  /** Near-miss cutoff for colors, normalized distance in [0,1]. Default 0.12. */
  threshold?: number;
  /** Restrict which literal kinds are scanned. Default both. */
  kinds?: Array<"color" | "dimension">;
}

const DEFAULT_THRESHOLD = 0.12;

// Group names commonly used for a raw primitive ramp. A semantic token
// (color.action.primary) is a better suggestion than the primitive it aliases
// (color.base.blue-600) even though both resolve to the same value.
const PRIMITIVE_GROUPS = new Set([
  "base",
  "palette",
  "core",
  "ref",
  "primitive",
  "global",
  "raw",
  "scale",
]);

function isPrimitive(path: string): boolean {
  return PRIMITIVE_GROUPS.has(path.split(".")[1] ?? "");
}

/** Rank candidate paths so the most semantic, shallowest one leads. Stable. */
function rankPaths(paths: string[]): string[] {
  return paths
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const pa = isPrimitive(a.p) ? 1 : 0;
      const pb = isPrimitive(b.p) ? 1 : 0;
      if (pa !== pb) return pa - pb; // semantic before primitive
      const da = a.p.split(".").length;
      const db = b.p.split(".").length;
      if (da !== db) return da - db; // shallower before deeper
      return a.i - b.i; // else preserve document order
    })
    .map((x) => x.p);
}

interface ColorRow {
  hex: string;
  rgb: RGB;
  paths: string[];
}

interface Index {
  all: Map<string, Resolution>;
  colorByHex: Map<string, string[]>;
  colors: ColorRow[];
  dimByValue: Map<string, string[]>;
}

/** Parse a DTCG dimension value ("16px", "1.5rem") to a canonical key. */
export function normDim(v: string): string | null {
  const m = /^(-?[\d.]+)(px|rem|em)$/i.exec(v.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!isFinite(n)) return null;
  return `${n}${m[2].toLowerCase()}`;
}

/** Build value -> token(s) reverse indexes from the resolved system. */
export function buildIndex(set: TokenSet): Index {
  const order = new Map([...set.tokens.keys()].map((p, i) => [p, i]));
  const byDoc = (a: string, b: string) =>
    (order.get(a) ?? 0) - (order.get(b) ?? 0);

  const all = resolveAll(set);
  const colorByHex = new Map<string, string[]>();
  const colorRgb = new Map<string, RGB>();
  const dimByValue = new Map<string, string[]>();

  for (const r of all.values()) {
    if (r.type === "color" && typeof r.value === "string") {
      const rgb = parseColor(r.value);
      if (!rgb) continue;
      const hex = canonicalHex(rgb);
      (colorByHex.get(hex) ?? colorByHex.set(hex, []).get(hex)!).push(r.path);
      if (!colorRgb.has(hex)) colorRgb.set(hex, rgb);
    } else if (r.type === "dimension" && typeof r.value === "string") {
      const key = normDim(r.value);
      if (!key) continue;
      (dimByValue.get(key) ?? dimByValue.set(key, []).get(key)!).push(r.path);
    }
  }

  for (const paths of colorByHex.values()) paths.sort(byDoc);
  for (const paths of dimByValue.values()) paths.sort(byDoc);

  const colors: ColorRow[] = [...colorByHex.entries()].map(([hex, paths]) => ({
    hex,
    rgb: colorRgb.get(hex)!,
    paths,
  }));

  return { all, colorByHex, colors, dimByValue };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function suggestion(
  paths: string[],
  all: Map<string, Resolution>,
  distance: number,
): AuditSuggestion {
  const ranked = rankPaths(paths);
  const best = ranked[0];
  const r = all.get(best)!;
  const alternatives = ranked.slice(1);
  return {
    path: best,
    value: r.value,
    type: r.type,
    distance: round3(distance),
    chain: r.chain,
    ...(alternatives.length ? { alternatives } : {}),
  };
}

/** Map a character offset to 1-based line/column. */
function lineIndexer(src: string): (idx: number) => { line: number; column: number } {
  const offsets = [0];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "\n") offsets.push(i + 1);
  }
  return (idx) => {
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: idx - offsets[lo] + 1 };
  };
}

// String.matchAll clones the regex, so these module-level globals are reuse-safe.
const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_LITERAL = /rgba?\([^)]*\)/gi;
const DIM_LITERAL = /(?<![\w.])-?\d+(?:\.\d+)?(?:px|rem|em)\b/gi;

function* scan(
  code: string,
  ...res: RegExp[]
): Generator<{ index: number; text: string }> {
  for (const re of res) {
    for (const m of code.matchAll(re)) {
      yield { index: m.index ?? 0, text: m[0] };
    }
  }
}

/** Audit a chunk of code against a design system. Pure; never throws on input. */
export function auditCss(
  set: TokenSet,
  code: string,
  opts: AuditOptions = {},
): AuditReport {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const kinds = new Set(opts.kinds ?? ["color", "dimension"]);
  const idx = buildIndex(set);
  const at = lineIndexer(code);
  const findings: AuditFinding[] = [];
  let scanned = 0;

  if (kinds.has("color")) {
    for (const m of scan(code, HEX_LITERAL, RGB_LITERAL)) {
      const rgb = parseColor(m.text);
      if (!rgb) continue; // e.g. #12345 (5 hex digits) — not a color
      scanned++;
      const norm = canonicalHex(rgb);
      const { line, column } = at(m.index);
      const base = { value: m.text, normalized: norm, kind: "color" as const, line, column };

      const exact = idx.colorByHex.get(norm);
      if (exact) {
        findings.push({ ...base, severity: "exact-miss", suggestion: suggestion(exact, idx.all, 0) });
        continue;
      }

      // Among tokens within threshold, prefer the most SEMANTIC, then the
      // nearest. A guessed button-blue should resolve to color.action.primary,
      // not to whatever raw ramp entry happens to sit a hair closer.
      const near = idx.colors
        .map((c) => ({ c, d: colorDistance(rgb, c.rgb), best: rankPaths(c.paths)[0] }))
        .filter((x) => x.d <= threshold)
        .sort((a, b) => {
          const pa = isPrimitive(a.best) ? 1 : 0;
          const pb = isPrimitive(b.best) ? 1 : 0;
          if (pa !== pb) return pa - pb; // semantic before primitive
          return a.d - b.d; // then nearest
        });
      if (near.length) {
        const win = near[0];
        findings.push({ ...base, severity: "near-miss", suggestion: suggestion(win.c.paths, idx.all, win.d) });
      } else {
        findings.push({ ...base, severity: "no-match", suggestion: null });
      }
    }
  }

  if (kinds.has("dimension")) {
    for (const m of scan(code, DIM_LITERAL)) {
      const norm = normDim(m.text);
      if (!norm) continue;
      scanned++;
      const exact = idx.dimByValue.get(norm);
      if (!exact) continue; // dimension near/no-match not reported in v0.1
      const { line, column } = at(m.index);
      findings.push({
        value: m.text,
        normalized: norm,
        kind: "dimension",
        line,
        column,
        severity: "exact-miss",
        suggestion: suggestion(exact, idx.all, 0),
      });
    }
  }

  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  const count = (s: Severity) => findings.filter((f) => f.severity === s).length;
  return {
    summary: {
      scanned,
      findings: findings.length,
      exactMiss: count("exact-miss"),
      nearMiss: count("near-miss"),
      noMatch: count("no-match"),
    },
    findings,
  };
}
