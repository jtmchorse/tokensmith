// Records the sequenced tokensmith demo to webm via Playwright.
// Scene 1: before/after cards. Scene 2: audit runs, then a live fix drops a
// finding. Run on CT108: cd /opt/drive-ui && node record-tokensmith.mjs
//
// NOTE: Playwright's video only emits frames when the page REPAINTS. A static
// hold produces a frozen (often blank) frame. So every on-screen "hold" here is
// a rAF loop that jiggles scroll by ±1px — visually imperceptible, but it keeps
// the compositor (and the encoder) alive.

import { chromium } from "playwright";

const URL = process.env.URL || "http://192.168.68.205:8899/index.html";
const OUT = "out/rec";
const W = 1280, H = 800;

// hold for `ms` while forcing continuous repaints (invisible ±1px jiggle)
async function hold(page, ms) {
  await page.evaluate(
    (ms) =>
      new Promise((res) => {
        const t0 = performance.now();
        let dir = 1;
        function step(now) {
          if (now - t0 >= ms) return res();
          dir = -dir;
          window.scrollBy(0, dir); // net zero, but repaints every frame
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }),
    ms,
  );
}

// eased rAF scroll to center an element — motion keeps frames flowing
async function scrollToEl(page, sel, ms) {
  await page.evaluate(
    ({ sel, ms }) =>
      new Promise((res) => {
        const el = document.querySelector(sel);
        const rect = el.getBoundingClientRect();
        const target =
          window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
        const start = window.scrollY;
        const dist = target - start;
        const t0 = performance.now();
        function step(now) {
          const p = Math.min(1, (now - t0) / ms);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          window.scrollTo(0, start + dist * e);
          p < 1 ? requestAnimationFrame(step) : res();
        }
        requestAnimationFrame(step);
      }),
    { sel, ms },
  );
}

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"],
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});
const page = await context.newPage();
const video = page.video();

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => window.scrollTo(0, 0));
await hold(page, 1400); // settle on the top (cards visible), with motion

// --- Scene 1: the before/after cards (they look identical) ---
await hold(page, 3200);

// --- transition: reveal the audit section ---
await scrollToEl(page, ".audit", 1500);
await hold(page, 700);

// --- Scene 2a: run the audit, findings stream in ---
await page.click("#run");
await hold(page, 2600);

// --- Scene 2b: fix #2563eb live, a finding clears ---
await page.click("#fix");
await hold(page, 2600);

// --- close on the install line ---
await scrollToEl(page, ".install", 1100);
await hold(page, 1600);

await context.close(); // finalizes the webm
await browser.close();

console.log("VIDEO:" + (await video.path()));
