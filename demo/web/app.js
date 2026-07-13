// Wires the interactive audit panel to the real bundled audit core
// (window.Tokensmith from audit.bundle.js). No backend.

const SAMPLE = `.save-btn {
  background: #2563eb;
  color: #ffffff;
  border-radius: 6px;
  padding: 10px 16px;
  font-family: -apple-system, sans-serif;
}
.save-btn:hover { background: #1e50c9; }
.danger-link { color: #ef4444; }`;

let code = SAMPLE;
const codeEl = document.getElementById("code");
const findingsEl = document.getElementById("findings");
const countEl = document.getElementById("count");

const sevClass = (s) =>
  s === "exact-miss" ? "exact" : s === "near-miss" ? "near" : "no";
const sevShort = (s) => s.replace("-miss", "");

function renderCode() {
  codeEl.textContent = code;
}

function renderFindings(report) {
  findingsEl.innerHTML = "";
  if (!report.findings.length) {
    findingsEl.innerHTML =
      '<div class="empty">&#10003; no off-system values &mdash; all on-system</div>';
  }
  report.findings.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "f";
    row.style.animationDelay = (i * 0.12).toFixed(2) + "s";
    let html = "";
    if (f.kind === "color") {
      html += `<span class="sw" style="background:${f.value}"></span>`;
      html += `<span>${f.value}</span><span class="arrow">&rarr;</span>`;
      html += `<span class="sw" style="background:${f.suggestion.value}"></span>`;
      html += `<span class="path">${f.suggestion.path}</span>`;
    } else {
      html += `<span>${f.normalized}</span><span class="arrow">&rarr;</span>`;
      html += `<span class="path">${f.suggestion.path}</span>`;
    }
    html += `<span class="chip ${sevClass(f.severity)}">${sevShort(f.severity)}</span>`;
    row.innerHTML = html;
    findingsEl.appendChild(row);
  });
  const s = report.summary;
  countEl.innerHTML = `<b>${s.findings}</b> off-system &middot; ${s.exactMiss} exact, ${s.nearMiss} near`;
}

function run() {
  renderFindings(window.Tokensmith.audit(code));
}

document.getElementById("run").addEventListener("click", run);
// convenience for screenshots/recording: ?run auto-runs the audit on load
if (location.search.includes("run")) run();
document.getElementById("fix").addEventListener("click", () => {
  code = code.replace("#2563eb", "var(--color-brand-primary)");
  renderCode();
  run();
});

renderCode();
