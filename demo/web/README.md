# tokensmith — live demo page

A zero-backend web demo of `audit_css`. It bundles the **real** audit core
(`dist/audit/*` + the Meridian example tokens) into the browser, so the page
audits code client-side — no server, hostable as static files (e.g. GitHub Pages).

- **`index.html`** — the page. Dogfoods Meridian: its own styling comes from the
  example tokens.
- **`app.js`** — wires the interactive panel to `window.Tokensmith`.
- **`src/entry.mjs`** — the browser entry (parses the inlined tokens, exposes `audit`).
- **`audit.bundle.js`** — generated; do not edit by hand.
- **`record-tokensmith.mjs`** — Playwright script that records the walkthrough video.

## Regenerate the bundle

From the repo root, after `npm run build`:

```bash
node_modules/.bin/esbuild demo/web/src/entry.mjs --bundle --format=iife \
  --global-name=Tokensmith --minify --outfile=demo/web/audit.bundle.js
```

## Run it locally

```bash
cd demo/web && python3 -m http.server 8899
# open http://localhost:8899/
```

`?run` in the URL auto-runs the audit on load (handy for screenshots).

## Record the walkthrough

Runs against a served copy of this page in a real browser (Playwright), producing
`out/rec/*.webm`. Then transcode to `demo/audit-demo.mp4` / `.gif` with ffmpeg.
See `record-tokensmith.mjs` for the scripted sequence (before/after → audit → live fix).
