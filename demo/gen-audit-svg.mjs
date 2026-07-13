// Generates demo/audit.svg — a self-contained, animated terminal render of a
// real audit_css run against demo/without.tsx. Data-accurate: the findings are
// computed live, not hand-authored. Regenerate with:  node demo/gen-audit-svg.mjs
//
// The SVG uses only CSS @keyframes (no <script>, no external refs) so it animates
// when embedded as an <img> in a GitHub README.

import { loadTokensFile } from "../dist/dtcg/loader.js";
import { auditCss } from "../dist/audit/audit.js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const set = loadTokensFile(join(HERE, "../examples/tokens.json"));
const code = readFileSync(join(HERE, "without.tsx"), "utf8");
const { summary, findings } = auditCss(set, code);

// ---- palette (Meridian's own dark surface — dogfooding the tokens) ----
const C = {
  bg: "#161a21",
  bar: "#2a303a",
  text: "#eceef1",
  muted: "#8b93a0",
  arrow: "#5b6472",
  exact: "#e8a221", // amber accent
  near: "#3573e8", // blue-500
  nomatch: "#c92c3d",
  ok: "#1e8a4c",
};
const sevColor = (s) =>
  s === "exact-miss" ? C.exact : s === "near-miss" ? C.near : C.nomatch;

// ---- layout ----
const W = 900;
const padX = 28;
const barH = 40;
const cmdY = barH + 40;
const rowH = 24;
const firstRow = cmdY + 34;
const H = firstRow + findings.length * rowH + 46;
const mono =
  "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace";
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const swatch = (x, y, fill) =>
  `<rect x="${x}" y="${y - 11}" width="13" height="13" rx="2" fill="${fill}" stroke="#ffffff22"/>`;

// build one finding row
function row(f, i) {
  const y = firstRow + i * rowH;
  const delay = (0.7 + i * 0.16).toFixed(2);
  const parts = [];
  parts.push(
    `<text x="${padX}" y="${y}" fill="${C.muted}">L${String(f.line).padEnd(4)}</text>`,
  );
  if (f.kind === "color") {
    const guess = f.normalized;
    const tok = f.suggestion.value;
    parts.push(swatch(72, y, guess));
    parts.push(`<text x="92" y="${y}" fill="${C.text}">${esc(guess)}</text>`);
    parts.push(`<text x="168" y="${y}" fill="${C.arrow}">→</text>`);
    parts.push(swatch(188, y, tok));
    parts.push(
      `<text x="208" y="${y}" fill="${C.text}">${esc(f.suggestion.path)}</text>`,
    );
  } else {
    parts.push(`<text x="72" y="${y}" fill="${C.text}">${esc(f.normalized)}</text>`);
    parts.push(`<text x="168" y="${y}" fill="${C.arrow}">→</text>`);
    parts.push(
      `<text x="208" y="${y}" fill="${C.text}">${esc(f.suggestion.path)}</text>`,
    );
  }
  const sev = f.severity;
  const chipW = sev.length * 7.4 + 16;
  const chipX = W - padX - chipW;
  parts.push(
    `<rect x="${chipX}" y="${y - 13}" width="${chipW}" height="18" rx="9" fill="${sevColor(sev)}22" stroke="${sevColor(sev)}55"/>` +
      `<text x="${chipX + chipW / 2}" y="${y}" fill="${sevColor(sev)}" text-anchor="middle" font-size="11">${sev}</text>`,
  );
  return `<g class="ln" style="animation-delay:${delay}s">${parts.join("")}</g>`;
}

const rows = findings.map(row).join("\n");
const lastDelay = (0.7 + findings.length * 0.16 + 0.2).toFixed(2);
const sumY = firstRow + findings.length * rowH + 26;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${mono}" font-size="14">
  <style>
    .ln { opacity: 0; animation: rise .45s ease forwards; }
    @keyframes rise { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
    .cur { animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .sum { opacity: 0; animation: rise .5s ease forwards; animation-delay: ${lastDelay}s; }
  </style>
  <rect width="${W}" height="${H}" rx="12" fill="${C.bg}"/>
  <rect width="${W}" height="${barH}" rx="12" fill="${C.bar}"/>
  <rect y="${barH - 12}" width="${W}" height="12" fill="${C.bar}"/>
  <circle cx="24" cy="20" r="6" fill="#ff5f56"/><circle cx="44" cy="20" r="6" fill="#ffbd2e"/><circle cx="64" cy="20" r="6" fill="#27c93f"/>
  <text x="${W / 2}" y="25" fill="${C.muted}" text-anchor="middle" font-size="12">tokensmith · audit_css</text>
  <text x="${padX}" y="${cmdY}" fill="${C.text}"><tspan fill="${C.ok}">$</tspan> audit_css <tspan fill="${C.muted}">SettingsCard.tsx</tspan> <tspan class="cur" fill="${C.text}">▊</tspan></text>
  ${rows}
  <text class="sum" x="${padX}" y="${sumY}" fill="${C.text}">${summary.findings} off-system values — <tspan fill="${C.exact}">${summary.exactMiss} exact</tspan>, <tspan fill="${C.near}">${summary.nearMiss} near</tspan>. <tspan fill="${C.muted}">Every guess had a token.</tspan></text>
</svg>
`;

writeFileSync(join(HERE, "audit.svg"), svg);
console.log(
  `wrote demo/audit.svg — ${findings.length} findings (${summary.exactMiss} exact, ${summary.nearMiss} near, ${summary.noMatch} no-match), ${W}x${H}`,
);
