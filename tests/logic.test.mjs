// Runs every worked example against FarmLogic (loaded exactly like the browser does: farm-data + farm-logic scripts in a vm).
// Contract: see meta.runnerContract in the examples file. The property checks live in props.test.mjs.
import fs from 'fs';
import path from 'path';
import { loadLogic, suite, ROOT } from './lib.mjs';

const EXAMPLES = process.env.EXAMPLES || path.join(ROOT, 'tests', 'worked-examples.json');
const doc = JSON.parse(fs.readFileSync(EXAMPLES, 'utf8'));
const L = loadLogic();
const t = suite(`worked examples (${doc.cases.length})`);

// Key order must not matter and undefined keys are dropped (JSON.stringify in suite.eq is order-sensitive otherwise).
const canon = v => Array.isArray(v) ? v.map(canon)
  : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => { if (v[k] !== undefined) o[k] = canon(v[k]); return o; }, {})
  : v;
const clone = v => JSON.parse(JSON.stringify(v));

for (const c of doc.cases) {
  let actual;
  try { actual = canon(clone(L[c.fn](...clone(c.args)))); }
  catch (e) { actual = { threw: String(e.message) }; }
  t.eq(actual, c.expected, `${c.id} ${c.title}`);
}
t.done();
