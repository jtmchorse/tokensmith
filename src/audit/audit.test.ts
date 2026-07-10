import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadTokensFile, parseTokens } from "../dtcg/loader.js";
import { auditCss, buildIndex, normDim } from "./audit.js";
import { canonicalHex, colorDistance, parseColor, parseHex } from "./color.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(HERE, "../../examples/tokens.json");
const set = loadTokensFile(EXAMPLE);

describe("color parsing", () => {
  it("expands 3-digit hex and lowercases", () => {
    expect(canonicalHex(parseHex("#FFF")!)).toBe("#ffffff");
  });

  it("parses rgb() to the same canonical hex as its #form", () => {
    expect(canonicalHex(parseColor("rgb(37, 87, 199)")!)).toBe("#2557c7");
  });

  it("rejects malformed hex (5 digits) and out-of-range rgb", () => {
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("rgb(300,0,0)")).toBeNull();
  });

  it("distance is 0 for identical and larger for a different hue", () => {
    const blue = parseColor("#2557c7")!;
    expect(colorDistance(blue, blue)).toBe(0);
    const guess = parseColor("#2563eb")!; // tailwind blue-600 vs meridian
    expect(colorDistance(blue, guess)).toBeLessThan(0.12); // same-hue drift
    const green = parseColor("#1e8a4c")!;
    expect(colorDistance(blue, green)).toBeGreaterThan(0.2); // different color
  });
});

describe("normDim", () => {
  it("canonicalizes numbers and units", () => {
    expect(normDim("16px")).toBe("16px");
    expect(normDim(" 16.0px ")).toBe("16px");
    expect(normDim("1.5REM")).toBe("1.5rem");
  });
  it("rejects non-dimensions", () => {
    expect(normDim("bold")).toBeNull();
    expect(normDim("12")).toBeNull();
  });
});

describe("buildIndex (example system)", () => {
  it("indexes brand blue under its semantic + primitive paths", () => {
    const idx = buildIndex(set);
    const paths = idx.colorByHex.get("#2557c7")!;
    expect(paths).toContain("color.base.blue-600");
    expect(paths).toContain("color.brand.primary");
  });

  it("indexes a shared dimension value across every alias", () => {
    const idx = buildIndex(set);
    // 16px is space.4 and everything aliasing it (space.inset.card, radius.lg…)
    expect(idx.dimByValue.get("16px")!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("auditCss — severities", () => {
  it("exact-miss: a raw token value gets flagged with a semantic suggestion", () => {
    const r = auditCss(set, "button { background: #2557c7; }");
    expect(r.summary.exactMiss).toBe(1);
    const f = r.findings[0];
    expect(f.severity).toBe("exact-miss");
    expect(f.suggestion!.distance).toBe(0);
    // primitive ramp entry is NOT the headline suggestion
    expect(f.suggestion!.path.startsWith("color.base")).toBe(false);
  });

  it("near-miss: a tailwind guess resolves toward the brand token", () => {
    const r = auditCss(set, "button { background: #2563eb; }");
    expect(r.summary.nearMiss).toBe(1);
    const f = r.findings[0];
    expect(f.severity).toBe("near-miss");
    expect(f.suggestion!.value).toBe("#2557c7");
    expect(f.suggestion!.distance).toBeGreaterThan(0);
  });

  it("no-match: an off-system color is surfaced without a suggestion", () => {
    const r = auditCss(set, "a { color: #7c3aed; }"); // a purple with no near token
    expect(r.findings[0].severity).toBe("no-match");
    expect(r.findings[0].suggestion).toBeNull();
  });

  it("dimension exact-miss is reported; a lone 13px is not", () => {
    const r = auditCss(set, "x { padding: 16px; margin: 13px; }");
    const dims = r.findings.filter((f) => f.kind === "dimension");
    expect(dims).toHaveLength(1);
    expect(dims[0].normalized).toBe("16px");
    expect(r.summary.scanned).toBe(2); // both 16px and 13px were scanned
  });

  it("threshold is tunable — strict mode downgrades a near-miss to no-match", () => {
    const strict = auditCss(set, "button { background: #2563eb; }", {
      threshold: 0.01,
    });
    expect(strict.findings[0].severity).toBe("no-match");
  });

  it("kinds filter restricts what is scanned", () => {
    const r = auditCss(set, "x { color: #2557c7; padding: 16px; }", {
      kinds: ["dimension"],
    });
    expect(r.findings.every((f) => f.kind === "dimension")).toBe(true);
  });

  it("reports 1-based line and column", () => {
    const code = "a{}\nb { color: #2557c7; }";
    const f = auditCss(set, code).findings[0];
    expect(f.line).toBe(2);
    expect(f.column).toBe(12); // "b { color: #..." — '#' is the 12th column
  });

  it("clean, on-system CSS produces zero findings", () => {
    const r = auditCss(set, "button { background: var(--color-action-primary); }");
    expect(r.summary.findings).toBe(0);
  });
});

describe("auditCss — the demo file lights up", () => {
  const without = readFileSync(join(HERE, "../../demo/without.tsx"), "utf8");
  const report = auditCss(set, without);

  it("flags the guessed values in without.tsx", () => {
    expect(report.summary.findings).toBeGreaterThan(5);
  });

  it("catches the headline blue drift #2563eb -> brand blue", () => {
    const blue = report.findings.find((f) => f.normalized === "#2563eb");
    expect(blue).toBeDefined();
    expect(blue!.severity).toBe("near-miss");
    expect(blue!.suggestion!.value).toBe("#2557c7");
  });

  it("catches #ffffff as an exact-miss on a surface token", () => {
    const white = report.findings.find((f) => f.normalized === "#ffffff");
    expect(white!.severity).toBe("exact-miss");
  });
});
