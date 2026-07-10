// Color parsing + a normalized distance for the audit tool.
//
// This is NOT CIEDE2000 — it is a redmean-weighted RGB distance normalized to
// [0,1] (0 = identical, 1 = black-vs-white). Cheap, dependency-free, and good
// enough for the one job audit_css needs: separate "same-hue shade drift"
// (small distance — the #2563eb vs #2557c7 case) from "a genuinely different
// color" (large distance). A perceptually exact metric is a v0.2 refinement.

export interface RGB {
  r: number;
  g: number;
  b: number;
  /** 0..1; 1 when the literal carried no alpha. */
  a: number;
}

const HEX_RE = /^#([0-9a-f]{3,8})$/i;

/** Parse "#rgb" | "#rgba" | "#rrggbb" | "#rrggbbaa" -> RGB, else null. */
export function parseHex(s: string): RGB | null {
  const m = HEX_RE.exec(s.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 && h.length !== 8) return null; // 5/7 hex digits = malformed
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

const RGB_RE =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/** Parse "rgb(r,g,b)" / "rgba(r,g,b,a)" -> RGB, else null. */
export function parseRgbFunc(s: string): RGB | null {
  const m = RGB_RE.exec(s.trim());
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if ([r, g, b].some((n) => !isFinite(n) || n < 0 || n > 255)) return null;
  return { r, g, b, a };
}

/** Parse any color literal audit_css recognizes (hex or rgb()/rgba()). */
export function parseColor(s: string): RGB | null {
  return parseHex(s) ?? parseRgbFunc(s);
}

/** Canonical lowercase #rrggbb(aa) — the reverse-index key form. */
export function canonicalHex(c: RGB): string {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  const base = `#${h(c.r)}${h(c.g)}${h(c.b)}`;
  return c.a < 1 ? `${base}${h(c.a * 255)}` : base;
}

// Max redmean distance (pure black vs pure white), used to normalize to [0,1].
const MAX_DISTANCE = 764.8333015286726;

/**
 * Normalized redmean color distance in [0,1]. Alpha is ignored — two colors
 * that differ only in opacity read as the same hue for drift purposes.
 * Reference: https://www.compuphase.com/cmetric.htm
 */
export function colorDistance(x: RGB, y: RGB): number {
  const rbar = (x.r + y.r) / 2;
  const dr = x.r - y.r;
  const dg = x.g - y.g;
  const db = x.b - y.b;
  const d = Math.sqrt(
    (2 + rbar / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rbar) / 256) * db * db,
  );
  return d / MAX_DISTANCE;
}
