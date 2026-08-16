import { chromium } from "playwright";

const [, , url, outPath, ...actions] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto(url, { waitUntil: "load" });

for (const action of actions) {
  const [type, selector] = action.split("::");
  if (type === "click") await page.click(selector);
  if (type === "fill") { const [sel, ...val] = selector.split("="); await page.fill(sel, val.join("=")); }
  if (type === "wait") await page.waitForTimeout(Number(selector));
}

await page.screenshot({ path: outPath, fullPage: true });
console.log("Console errors:", errors.length ? errors : "none");
await browser.close();
