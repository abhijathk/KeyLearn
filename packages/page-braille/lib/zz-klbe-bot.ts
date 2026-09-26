// Temporary (e2e-kl-backend): a real braille sitting in headless Chrome on TEST :4200.
import fs from "node:fs";
import { cellsForText, KEY_TO_DOT } from "@keylearn/braille";
import { PublicId } from "@keylearn/publicid";
// @ts-ignore
import { chromium } from "/Users/abhijathkottikkal/Projects/Automation practice/node_modules/playwright-core/index.mjs";
const K = "/private/tmp/claude-501/-Users-abhijathkottikkal-Documents-KeyLearn/2b8e5a17-9f01-40b0-b1ed-ec4d05459ded/scratchpad/e2e/klbe";
const { session, uid } = JSON.parse(fs.readFileSync(K + "/proctor.json", "utf8"));
const PROFILE = process.env.PROFILE ?? "770";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext();
await ctx.addCookies([{ name: "session", value: session, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
let served: string | null = null;
let posted: any = null;
page.on("response", async (res: any) => {
  const u = res.url();
  if (u.includes("/sitting/") && u.endsWith("/start")) { try { served = (await res.json()).text; } catch {} }
  else if (/\/_\/certificate\/sitting\/\d+$/.test(u)) posted = { status: res.status(), body: await res.text().catch(() => "") };
});
page.on("request", (req: any) => { if (/\/_\/certificate\/sitting\/\d+$/.test(req.url())) fs.writeFileSync(K + "/b-posted-" + PROFILE + ".json", req.postData() ?? ""); });
// Choose the learner on this device, as the profile picker would.
await page.goto("http://localhost:4200/", { waitUntil: "networkidle" });
await page.evaluate(
  ([pub, pid]: string[]) => localStorage.setItem("keylearn.activeProfile." + pub, pid),
  [String(new PublicId(uid)), PROFILE],
);
await page.goto("http://localhost:4200/assessment", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
// The device asks who is practising; answer it the way a person would.
const who = page.getByText(process.env.WHO ?? "Brai", { exact: true }).first();
if (await who.isVisible().catch(() => false)) {
  await who.click();
  await page.waitForTimeout(2500);
  // Choosing a learner can land on their home page; the sitting is here.
  served = null;
  await page.goto("http://localhost:4200/assessment", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
}
console.log("url:", page.url());
await page.waitForTimeout(1500);
await page.screenshot({ path: K + "/b-braille-start.png" });
console.log("served:", (served ?? "").slice(0, 60));
const words = (served ?? "").split(" ").filter((w) => w !== "");
const dotKeys = [...KEY_TO_DOT].map(([code, dot]) => ({ code, dot }));
let x = 11; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
const until = Date.now() + 63_000; // one adult run is 60 s; three runs
let cursor = 0; let cells = 0;
// Where the page's current line starts in the served words: its printed
// characters appear as single-character tokens in the page text.
async function resync(): Promise<number> {
  const tc = await page.evaluate(() => document.body.textContent ?? "");
  const line = (tc.split("days")[1] ?? "").replace(/[\u2800-\u28FF]/g, "");
  for (let w = 0; w < words.length; w++) {
    if (line.startsWith(words.slice(w, w + 8).join(" "))) return w;
  }
  return -1;
}
for (let run = 0; run < 3 && posted == null; run++) {
  await page.screenshot({ path: K + "/b-braille-run" + (run + 1) + ".png" });
  if (process.env.LOOK === "1") {
    const tc = await page.evaluate(() => document.body.textContent ?? "");
    const it = await page.evaluate(() => document.body.innerText ?? "");
    console.log("served words:", JSON.stringify(words.slice(0, 20).join(" ")));
    console.log("textContent:", JSON.stringify(tc.slice(0, 600)));
    console.log("innerText:", JSON.stringify(it.slice(0, 400)));
    await browser.close(); process.exit(0);
  }
  const at = await resync();
  console.log("run", run + 1, "page starts at word", at);
  if (at >= 0) cursor = at;
  const runUntil = Date.now() + 61_500;
  while (Date.now() < runUntil) {
    const passage = [];
    for (let i = 0; i < 8; i++) passage.push(words[(cursor + i) % words.length]);
    cursor += 8;
    for (const step of cellsForText(passage.join(" "))) {
      if (Date.now() >= runUntil) break;
      const cell = typeof step === "number" ? step : (step as any).cell;
      if (cell === 0) { await page.keyboard.press("Space"); }
      else {
        const down = dotKeys.filter((k) => (cell & k.dot) !== 0);
        for (const k of down) await page.keyboard.down(k.code);
        await page.waitForTimeout(30);
        for (const k of down) await page.keyboard.up(k.code);
      }
      cells++;
      await page.waitForTimeout(500 + Math.round(rnd() * 500));
    }
  }
  console.log("run", run + 1, "cells", cells);
  await page.waitForTimeout(2500);
  const start = page.getByRole("button", { name: /^Start run/ });
  if (await start.isVisible().catch(() => false)) { await start.click(); await page.waitForTimeout(1500); }
}
await page.waitForTimeout(5000);
await page.screenshot({ path: K + "/b-braille-end.png" });
console.log("posted:", JSON.stringify(posted).slice(0, 200));
await browser.close();
