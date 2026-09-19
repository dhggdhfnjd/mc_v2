// Regenerates the screenshots in docs/manual/ for docs/USER_MANUAL.md: drives the running app
// with real key presses in headless Chrome and saves one PNG per screen.
//
//   npm run dev                      # in the repo root, in another terminal
//   (cd tests && npm install)        # once: provides puppeteer-core
//   node tools/manual/shots.mjs      # BASE=http://localhost:3000 by default
//
// Needs a local Chrome (set CHROME_PATH if it is not in the default macOS location).
// demo-tomatoes.jpg is a drawing made for this manual, so no third-party photo rights apply.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "../../tests/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = path.join(HERE, "..", "..", "docs", "manual");
const DEMO_PHOTO = path.join(HERE, "demo-tomatoes.jpg");
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function phone(query, width, height, scale) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  const open = async (q) => {
    await page.goto(`${BASE}/${q}`, { waitUntil: "networkidle0" });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await sleep(600);
  };
  await open(query);
  const press = async (...keys) => {
    for (const k of keys) {
      await page.keyboard.press(k);
      await sleep(140);
    }
  };
  const type = (digits) => press(...String(digits).split(""));
  const shot = async (name) => {
    await sleep(250);
    await page.screenshot({ path: path.join(OUT, name + ".png") });
    console.log("saved", name);
  };
  return { page, press, type, shot, open };
}

// ---------- QVGA 240x320, the main tour ----------
{
  const { page, press, type, shot, open } = await phone("?bare=1", 240, 320, 2);
  await shot("01-home");
  await press("1");
  await shot("02-area");
  await press("Enter");
  await sleep(500);
  await type(2);
  await shot("03-price");
  await press("Enter");
  await sleep(600);
  await shot("04-calc-empty");
  await type(4250);
  await shot("05-calc-low");
  await press("Escape");
  await sleep(400);
  await shot("06-showcard");
  await press("F12");
  await sleep(300);
  await press("F12", "F12", "F12", "F12");
  await type(4900);
  await shot("07-calc-good");
  await press("Enter");
  await sleep(500);
  await press("ArrowDown");
  await type(10000);
  await shot("08-close");
  await press("Enter");
  await sleep(350);
  await shot("09-saved");
  await sleep(2200);
  await shot("10-price-updated");

  await press("Escape");
  await shot("11-menu");
  await press("Enter");
  await sleep(500);
  await shot("12-demands");
  await press("Escape");
  await sleep(500);
  await shot("13-map");
  await press("ArrowUp");
  await shot("14-map-moved");
  await press("Enter");
  await sleep(300);
  await shot("15-buyer");
  await press("F12", "F12", "F12");
  await sleep(300);

  await press("Escape", "2");
  await sleep(500);
  await press("ArrowRight");
  await sleep(300);
  await shot("16-history");
  await press("Escape");
  await sleep(500);
  await shot("17-season");
  await press("F12");
  await sleep(300);

  await press("Escape", "4");
  await sleep(300);
  await type(900);
  await press("Enter");
  await sleep(350);
  await shot("18-report-refused");
  await sleep(2000);

  await press("Escape", "5");
  await sleep(300);
  await type(500);
  await press("ArrowDown");
  await type(60);
  await press("ArrowDown", "ArrowDown");
  await type("0700000123");
  await shot("19-post-demand");
  await press("F12", "F12", "F12", "F12", "F12", "F12", "F12", "F12", "F12", "F12", "F12");
  await sleep(300);

  // wherever the clears left us, get back to the crop's price screen deterministically
  await open("?bare=1");
  await press("1");
  await sleep(500);
  await press("Escape", "6");
  await sleep(500);
  await shot("20-ledger");
  await press("F12");
  await sleep(300);
  await press("Escape", "7");
  await sleep(300);
  await type(10000);
  await press("ArrowDown");
  await type(279);
  await shot("21-fx");
  await press("Escape");
  await shot("22-str-card");
  await press("F12", "F12", "F12", "F12", "F12", "F12", "F12");
  await sleep(300);

  await open("?bare=1");
  await press("Escape");
  await shot("23-home-menu");
  await press("5");
  await sleep(300);
  await shot("24-settings");
  await press("Enter");
  await sleep(200);
  await shot("25-settings-swahili");
  await press("Enter");
  await press("F12");
  await sleep(300);

  await press("0");
  await page.waitForFunction(() => document.body.innerText.includes("Recognizer ready"), { timeout: 60000 });
  await shot("26-photo-ready");
  const input = await page.$('input[type="file"]');
  await input.uploadFile(DEMO_PHOTO);
  await page.waitForFunction(() => /\d+%/.test([...document.querySelectorAll(".host")].filter((h) => !h.hidden)[0]?.innerText ?? ""), { timeout: 60000 });
  await shot("27-photo-result");
  await page.close();
}

// ---------- QQVGA 128x160 ----------
{
  const { page, press, type, shot } = await phone("?bare=1&size=qq", 128, 160, 3);
  await press("1");
  await sleep(600);
  await type(2);
  await shot("28-qqvga-price");
  await press("Enter");
  await sleep(600);
  await type(4250);
  await shot("29-qqvga-calc");
  await page.close();
}

// ---------- desktop frame ----------
{
  const { page, shot } = await phone("", 1100, 860, 1);
  await shot("30-desktop");
  await page.close();
}

await browser.close();
console.log("done");
