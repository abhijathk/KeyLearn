// Temporary (e2e-kl-backend): a real kids sitting in headless Chrome on TEST :4200.
import fs from "node:fs";
import { PublicId } from "@keylearn/publicid";
// @ts-ignore
import { chromium } from "/Users/abhijathkottikkal/Projects/Automation practice/node_modules/playwright-core/index.mjs";
const K = "/private/tmp/claude-501/-Users-abhijathkottikkal-Documents-KeyLearn/2b8e5a17-9f01-40b0-b1ed-ec4d05459ded/scratchpad/e2e/klbe";
const { session, uid } = JSON.parse(fs.readFileSync(K + "/proctor.json", "utf8"));
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addCookies([{ name: "session", value: session, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
let served: string | null = null;
let posted: any = null;
page.on("response", async (res: any) => {
  const u = res.url();
  if (u.includes("/sitting/") && u.endsWith("/start")) { try { served = (await res.json()).text; } catch {} }
  else if (/\/_\/certificate\/sitting\/\d+$/.test(u)) posted = { status: res.status(), body: await res.text().catch(() => "") };
});
page.on("request", (req: any) => { if (/\/_\/certificate\/sitting\/\d+$/.test(req.url())) fs.writeFileSync(K + "/b-posted-769.json", req.postData() ?? ""); });
await page.goto("http://localhost:4200/", { waitUntil: "networkidle" });
await page.evaluate(([pub, pid]: string[]) => localStorage.setItem("keylearn.activeProfile." + pub, pid), [String(new PublicId(uid)), "769"]);
await page.goto("http://localhost:4200/assessment", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const who = page.getByText("Kavi", { exact: true }).first();
if (await who.isVisible().catch(() => false)) {
  await who.click();
  await page.waitForTimeout(2500);
  served = null;
  await page.goto("http://localhost:4200/assessment", { waitUntil: "networkidle" });
}
await page.waitForTimeout(8000);
await page.screenshot({ path: K + "/b-kids-start.png" });
console.log("url:", page.url(), "served:", (served ?? "").slice(0, 60));
if (process.env.LOOK === "1") {
  console.log("text:", JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 700)));
  await browser.close(); process.exit(0);
}

// The hatch dialog is the kids page's own first-run greeting; a child says hello.
const hello = page.getByRole("button", { name: /Say hello/ });
if (await hello.isVisible().catch(() => false)) {
  await hello.click();
  await page.waitForTimeout(2000);
}
async function passage(): Promise<string> {
  const text = await page.evaluate(() => document.body.innerText);
  const m = /BEST\n\d+\n([^\n]+)\n/.exec(text);
  return m?.[1] ?? "";
}
let x = 5; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
const until = Date.now() + 47_000;
let keys = 0;
let last = "";
while (Date.now() < until && posted == null) {
  const line = await passage();
  if (line === "" || line === last) { await page.waitForTimeout(300); continue; }
  last = line;
  console.log("passage:", JSON.stringify(line.slice(0, 50)), "in served:", (served ?? "").includes(line.slice(0, 20)));
  for (const c of line) {
    if (Date.now() >= until) break;
    await page.keyboard.type(c);
    keys += 1;
    await page.waitForTimeout(160 + Math.round(rnd() * 220));
  }
  await page.waitForTimeout(700);
}
console.log("typed", keys);
await page.waitForTimeout(6000);
await page.screenshot({ path: K + "/b-kids-end.png" });
console.log("posted:", JSON.stringify(posted).slice(0, 200));
await browser.close();
