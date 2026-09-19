// Shared harness: open the app in headless Chrome and drive BOTH phones like keypad phones.
// Needs system Chrome (set CHROME_PATH to override) and `npm install` in this folder.
//
// App contract (spec item 13):
//   #screen-A / #screen-B                       screen containers (each has data-view="…")
//   window.FarmApp = { getView(p), getState(p), screenText(p), setScreenSize(p,size), setLang(p,lang), focus(p),
//                      server: { getState(), reset(seed), setNetwork('ok'|'flaky'|'down') } }     p = 'A' | 'B'
//   Keys are keydown events on document.body, routed to the currently focused phone.
import puppeteer from 'puppeteer-core';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import vm from 'vm';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_FILE = path.join(ROOT, 'index.html');
export const APP = pathToFileURL(APP_FILE).href;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// '#' deliberately shares 3's keyCode (Cloud Phone quirk); soft keys have no legacy keyCode.
const KEYCODES = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Enter: 13, Backspace: 8, Escape: 27, SoftLeft: 0, SoftRight: 0, '*': 170, '#': 51 };
export const codeOf = k => KEYCODES[k] ?? (/^[0-9]$/.test(k) ? 48 + Number(k) : k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0);
export const ALL_KEYS = ['0','1','2','3','4','5','6','7','8','9','*','#','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','SoftLeft','SoftRight','Backspace','Escape'];

async function dispatch(page, key) {
  await page.evaluate((key, code) => {
    for (const type of ['keydown', 'keyup']) {
      document.body.dispatchEvent(new KeyboardEvent(type, { key, keyCode: code, which: code, bubbles: true, cancelable: true }));
    }
  }, key, codeOf(key));
}

export async function open({ width = 1400, height = 900, url = APP, size, lang } = {}) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  await page.goto(url, { waitUntil: 'load' });
  const phone = p => ({
    id: p,
    press: async k => { await page.evaluate(p => window.FarmApp.focus(p), p); await dispatch(page, k); },
    seq: async s => { for (const k of s.trim().split(/\s+/)) { await page.evaluate(p => window.FarmApp.focus(p), p); await dispatch(page, k); } },
    view: () => page.evaluate(p => window.FarmApp.getView(p), p),
    state: () => page.evaluate(p => window.FarmApp.getState(p), p),
    text: () => page.evaluate(p => window.FarmApp.screenText(p), p),
    setSize: s => page.evaluate((p, s) => window.FarmApp.setScreenSize(p, s), p, s),
    setLang: l => page.evaluate((p, l) => window.FarmApp.setLang(p, l), p, l),
    shot: async file => { fs.mkdirSync(path.dirname(file), { recursive: true }); const el = await page.$('#screen-' + p); await (el ?? page).screenshot({ path: file }); return file; },
  });
  const A = phone('A'), B = phone('B');
  if (size) { await A.setSize(size); await B.setSize(size); }
  if (lang) { await A.setLang(lang.A ?? lang); await B.setLang(lang.B ?? lang); }
  return {
    browser, page, errors, A, B, phone: p => (p === 'A' ? A : B),
    server: {
      state: () => page.evaluate(() => window.FarmApp.server.getState()),
      reset: seed => page.evaluate(seed => window.FarmApp.server.reset(seed), seed),
      network: m => page.evaluate(m => window.FarmApp.server.setNetwork(m), m),
    },
    pageShot: async file => { fs.mkdirSync(path.dirname(file), { recursive: true }); await page.screenshot({ path: file }); return file; },
    close: () => browser.close(),
  };
}

// Load the pure-logic scripts WITHOUT a browser (fast unit tests). The app must keep data + logic in
// <script id="farm-data"> and <script id="farm-logic"> and not touch the DOM there.
export function loadLogic(file = APP_FILE) {
  const html = fs.readFileSync(file, 'utf8');
  const grab = id => { const m = html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`)); return m ? m[1] : ''; };
  const sandbox = { console, Math, Date, JSON, Number, String, Array, Object, Map, Set, Intl };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const id of ['farm-data', 'farm-logic']) vm.runInContext(grab(id), sandbox, { filename: id + '.js' });
  return sandbox.FarmLogic;
}

// Tiny assert/reporting helpers so test files stay short.
export function suite(name) {
  const fails = []; let n = 0;
  return {
    ok(cond, msg) { n++; if (!cond) fails.push(msg); },
    eq(actual, expected, msg) { n++; if (JSON.stringify(actual) !== JSON.stringify(expected)) fails.push(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); },
    done() {
      console.log(`${fails.length ? 'FAIL' : 'PASS'} ${name}: ${n - fails.length}/${n}`);
      for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
      if (fails.length > 40) console.log(`  … ${fails.length - 40} more`);
      process.exitCode = fails.length ? 1 : process.exitCode;
      return fails;
    },
  };
}
