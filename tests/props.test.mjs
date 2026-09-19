// Property / randomized tests for FarmLogic + FarmData (no browser). Fixed seeds, no Math.random.
// Complements logic.test.mjs (worked examples): these check INVARIANTS over many generated inputs.
//   node props.test.mjs            -> all sections
//   SEED=7 node props.test.mjs     -> different seed offset (default 1)
//   STRICT_ERR_KEYS=1 ...          -> also require an e.<CODE> i18n key for every error code the logic can return
import fs from 'fs';
import vm from 'vm';
import { loadLogic, suite, APP_FILE } from './lib.mjs';

const L = loadLogic();
const D = (() => { // FarmData is not exported by loadLogic(); load it the same way
  const html = fs.readFileSync(APP_FILE, 'utf8');
  const sb = {}; sb.window = sb; vm.createContext(sb);
  vm.runInContext(html.match(/<script id="farm-data"[^>]*>([\s\S]*?)<\/script>/)[1], sb, { filename: 'farm-data.js' });
  return sb.FarmData;
})();
const { MAX_GRAMS, MAX_PRICE, DAY, HOUR } = L.CONST;
const SEED0 = Number(process.env.SEED || 1);
const T0 = 1789795800000;
const PACKS = D.packOrder.slice();

// ---------------------------------------------------------------- helpers
function mulberry32(seed) { // own copy: makePrng is itself under test
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const mkRng = salt => { const r = mulberry32(SEED0 * 1000003 + salt); return { f: r, int: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: arr => arr[Math.floor(r() * arr.length)], logInt: (a, b) => Math.max(a, Math.min(b, Math.round(Math.exp(Math.log(a) + r() * (Math.log(b) - Math.log(a)))))), shuffle: arr => { const x = arr.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; } }; };
const bdiv = (n, d) => { n = BigInt(n); d = BigInt(d); const a = n < 0n ? -n : n; const q = (2n * a + d) / (2n * d); return Number(n < 0n ? -q : q); };
const isInt = n => typeof n === 'number' && Number.isInteger(n);
const clone = v => JSON.parse(JSON.stringify(v));
const J = JSON.stringify;
const chk = (t, cond, msg) => t.ok(!!cond, cond ? '' : (typeof msg === 'function' ? msg() : msg));
const eqDeep = (t, a, b, msg) => t.ok(J(a) === J(b), J(a) === J(b) ? '' : `${typeof msg === 'function' ? msg() : msg}: ${J(a).slice(0, 200)} != ${J(b).slice(0, 200)}`);
const sorted = (arr, cmp) => arr.every((x, i) => i === 0 || cmp(arr[i - 1], x) <= 0);
const P = id => D.packs[id];
// every finite-number leaf in an object (skips nested objects named in `skip`)
const numLeaves = (o, skip = []) => { const out = []; for (const [k, v] of Object.entries(o)) { if (skip.includes(k)) continue; if (typeof v === 'number') out.push([k, v]); } return out; };

// ================================================================ 1. arithmetic primitives
{
  const t = suite('props: roundDiv / roundToStep'); const r = mkRng(1);
  for (let i = 0; i < 4000; i++) {
    const n = r.int(-2e9, 2e9) * (r.f() < 0.3 ? 1000 : 1), d = r.logInt(1, 2e6);
    chk(t, L.roundDiv(n, d) === bdiv(n, d), () => `roundDiv(${n},${d})=${L.roundDiv(n, d)} want ${bdiv(n, d)}`);
    chk(t, L.roundDiv(-n, d) === -L.roundDiv(n, d), () => `roundDiv not symmetric at ${n}/${d}`);
  }
  for (const [n, d, want] of [[5, 2, 3], [-5, 2, -3], [1, 2, 1], [-1, 2, -1], [0, 7, 0], [3, 2, 2], [7, 3, 2], [8, 3, 3]]) t.eq(L.roundDiv(n, d), want, `roundDiv(${n},${d})`);
  for (const bad of [[1.5, 2], [1, 0], [1, -3], [NaN, 2], [Infinity, 1], ['5', 2], [null, 1], [1, 0.5]]) chk(t, Number.isNaN(L.roundDiv(...bad)), `roundDiv(${bad}) should be NaN`);
  for (let i = 0; i < 4000; i++) {
    const m = r.int(-100000, 100000), s = r.pick([1, 5, 10, 50, 100, 500]);
    const nr = L.roundToStep(m, s, 'nearest'), dn = L.roundToStep(m, s, 'down'), up = L.roundToStep(m, s, 'up');
    chk(t, nr % s === 0 && dn % s === 0 && up % s === 0, () => `step multiple ${m},${s}`);
    chk(t, dn <= m && m <= up && up - dn <= s, () => `down<=x<=up ${m},${s}: ${dn},${up}`);
    chk(t, Math.abs(nr - m) * 2 <= s, () => `nearest within half step ${m},${s}: ${nr}`);
    chk(t, (m % s === 0) === (dn === up), () => `exact multiples are fixed points ${m},${s}`);
    chk(t, L.roundToStep(nr, s) === nr, () => `idempotent ${m},${s}`);
  }
  for (const bad of [[1.5, 5], [10, 0], [10, -5], [NaN, 5]]) chk(t, L.roundToStep(...bad) === null, `roundToStep(${bad}) should be null`);
  t.done();
}

// ================================================================ 2. dealSheet: integers, no NaN/negatives, identities
const NEVER_NEG = ['totalMinor', 'amountDueMinor', 'buyerFeeMinor', 'sellerFeeMinor', 'buyerPaysMinor', 'sellerGetsMinor', 'km', 'freightMinor', 'buyerFreightMinor', 'sellerFreightMinor', 'lossBps', 'lossGrams', 'sellableGrams', 'buyerLandedPerKgMinor'];
{
  const t = suite('props: dealSheet money invariants'); const r = mkRng(2);
  let okN = 0, errN = 0;
  for (let i = 0; i < 6000; i++) {
    const pid = r.pick(PACKS), p = P(pid), crop = r.pick(p.crops), oM = r.pick(p.markets).id, bM = r.pick(p.markets).id, pay = r.pick(p.payments);
    const terms = { grams: r.f() < 0.1 ? r.pick([p.minGrams, MAX_GRAMS, p.minGrams + 1]) : r.logInt(p.minGrams, 5e6), priceMinorPerKg: r.f() < 0.1 ? r.pick([1, MAX_PRICE, 99999]) : r.logInt(1, 500000), grade: r.pick(p.grades), delivery: r.pick(p.deliveries), payment: pay.id };
    const ctx = { cropId: crop.id, originMarketId: oM, buyerMarketId: bM };
    if (pay.sellerFee && r.f() < 0.5) ctx.userFeeBps = r.int(0, 1000);
    if (r.f() < 0.3) ctx.refMid = r.logInt(1, 500000);
    const s = L.dealSheet(pid, terms, ctx);
    if (!s.ok) { errN++; chk(t, s.error === 'ALL_LOST', () => `unexpected error ${s.error} for ${J(terms)} ${J(ctx)}`); continue; }
    okN++;
    const tag = () => `${pid} ${J(terms)} ${J(ctx)}`;
    for (const [k, v] of numLeaves(s)) chk(t, isInt(v), () => `${k} not integer (${v}) ${tag()}`);
    for (const k of NEVER_NEG) chk(t, s[k] >= 0, () => `${k} negative (${s[k]}) ${tag()}`);
    chk(t, s.totalMinor === bdiv(BigInt(terms.grams) * BigInt(terms.priceMinorPerKg), 1000), () => `total ${tag()}`);
    chk(t, s.buyerPaysMinor === s.amountDueMinor + s.buyerFeeMinor && s.sellerGetsMinor === s.amountDueMinor - s.sellerFeeMinor, () => `pays/gets identity ${tag()}`);
    chk(t, s.cashRoundingMinor === s.amountDueMinor - s.totalMinor && (pay.cashRounding ? Math.abs(s.cashRoundingMinor) * 2 <= p.currency.cashStep && s.amountDueMinor % p.currency.cashStep === 0 : s.cashRoundingMinor === 0), () => `cash rounding ${tag()}`);
    chk(t, s.sellableGrams > 0 && s.sellableGrams <= terms.grams && s.lossGrams >= 0, () => `sellable ${tag()}`);
    if (terms.delivery === 'pickup') chk(t, s.sellableGrams === terms.grams - s.lossGrams && s.sellerFreightMinor === 0 && s.buyerFreightMinor === s.freightMinor, () => `pickup split ${tag()}`);
    else chk(t, s.sellableGrams === terms.grams && s.buyerFreightMinor === 0 && s.sellerFreightMinor === s.freightMinor, () => `deliver split ${tag()}`);
    chk(t, s.km === 0 ? s.freightMinor === 0 && s.lossBps === 0 : s.freightMinor >= p.freight.minMinor && s.lossBps <= p.lossCapBps, () => `freight/loss vs km ${tag()}`);
    chk(t, s.lossGrams === bdiv(BigInt(terms.grams) * BigInt(s.lossBps), 10000), () => `lossGrams ${tag()}`);
    chk(t, s.buyerLandedPerKgMinor === bdiv((BigInt(s.buyerPaysMinor) + BigInt(s.buyerFreightMinor)) * 1000n, s.sellableGrams), () => `landed ${tag()}`);
    chk(t, s.sellerPocketPerKgMinor === bdiv((BigInt(s.sellerGetsMinor) - BigInt(s.sellerFreightMinor)) * 1000n, terms.grams), () => `pocket ${tag()}`);
    if (terms.delivery === 'pickup') chk(t, s.sellerPocketPerKgMinor >= 0, () => `pickup pocket must be >=0 ${tag()}`);
    const major = Math.floor(s.amountDueMinor / p.currency.minorPerMajor);
    chk(t, s.readbackRequired === (major >= p.readbackMinMajor) && /^\d\d$/.test(s.lastTwo) && s.lastTwo === String(major % 100).padStart(2, '0'), () => `readback ${tag()}`);
    chk(t, (s.cliff === null) === !pay.buyerFee, () => `cliff presence ${tag()}`);
    chk(t, (s.magnitude === null) === (ctx.refMid == null), () => `magnitude presence ${tag()}`);
    for (const k of ['totalMinor', 'amountDueMinor', 'buyerPaysMinor', 'sellerGetsMinor', 'buyerLandedPerKgMinor', 'sellerPocketPerKgMinor']) {
      const f = L.fmtMoney(pid, s[k]); chk(t, /\d/.test(f) && !/NaN|undefined|Infinity|—/.test(f), () => `fmtMoney(${k}) = ${f}`);
    }
  }
  chk(t, okN > 4000 && errN < 1500, () => `generator balance ok=${okN} err=${errN}`);
  // error paths never throw and never return a half-built sheet
  const base = { grams: 20000, priceMinorPerKg: 440, grade: 'A', delivery: 'pickup', payment: 'cash' }, ctx = { cropId: 'tomato', originMarketId: 'dawanau', buyerMarketId: 'sabongari' };
  const garbage = [NaN, Infinity, -Infinity, -1, 0, 1.5, '5', null, undefined, {}, [], MAX_GRAMS + 1, 2 ** 53];
  for (const g of garbage) {
    for (const [field, code] of [['grams', 'BAD_GRAMS'], ['priceMinorPerKg', 'BAD_PRICE']]) {
      let res; try { res = L.dealSheet('ng-kano', { ...base, [field]: g }, ctx); } catch (e) { res = { threw: String(e) }; }
      chk(t, res.ok === false && res.error === code, () => `dealSheet ${field}=${String(g)} -> ${J(res)}`);
    }
    let res; try { res = L.lineTotal(g, 100); } catch (e) { res = { threw: 1 }; }
    chk(t, res.ok === false && res.error === 'BAD_GRAMS' || (res.ok === true && g === 0), () => `lineTotal grams=${String(g)} -> ${J(res)}`);
    try { res = L.lineTotal(1000, g); } catch (e) { res = { threw: 1 }; }
    chk(t, res.ok === false && res.error === 'BAD_PRICE' || (res.ok === true && g === 0), () => `lineTotal price=${String(g)} -> ${J(res)}`);
  }
  for (const [patch, code] of [[{ grade: 'Z' }, 'BAD_GRADE'], [{ delivery: 'drone' }, 'BAD_DELIVERY'], [{ payment: 'bitcoin' }, 'BAD_PAYMENT'], [{ grams: 999 }, 'BAD_GRAMS'], [{ priceMinorPerKg: MAX_PRICE + 1 }, 'BAD_PRICE']]) {
    eqDeep(t, L.dealSheet('ng-kano', { ...base, ...patch }, ctx), { ok: false, error: code }, `dealSheet ${J(patch)}`);
  }
  eqDeep(t, L.dealSheet('ng-kano', base, { ...ctx, cropId: 'zz' }), { ok: false, error: 'UNKNOWN_CROP' }, 'unknown crop');
  eqDeep(t, L.dealSheet('ng-kano', base, { ...ctx, originMarketId: 'dawanau', buyerMarketId: 'nowhere' }), { ok: false, error: 'UNKNOWN_MARKET_PAIR' }, 'unknown pair');
  chk(t, L.dealSheet('ng-kano', { ...base, grams: MAX_GRAMS, priceMinorPerKg: MAX_PRICE }, ctx).ok, 'extreme max terms must still work');
  t.done();
}

// ================================================================ 3. monotonic totals
{
  const t = suite('props: totals are monotone in quantity and price'); const r = mkRng(3);
  for (let i = 0; i < 1500; i++) {
    const pid = r.pick(PACKS), p = P(pid), crop = r.pick(p.crops), pay = r.pick(p.payments), delivery = r.pick(p.deliveries);
    const oM = r.pick(p.markets).id, bM = r.pick(p.markets).id, ctx = { cropId: crop.id, originMarketId: oM, buyerMarketId: bM };
    const g1 = r.logInt(p.minGrams, 1e6), g2 = g1 + r.logInt(1, 1e6), p1 = r.logInt(1, 200000), p2 = p1 + r.logInt(1, 100000);
    const mk = (g, pr) => L.dealSheet(pid, { grams: g, priceMinorPerKg: pr, grade: 'A', delivery, payment: pay.id }, ctx);
    const tag = () => `${pid} ${crop.id} ${oM}>${bM} ${delivery} ${pay.id} g ${g1}->${g2} p ${p1}->${p2}`;
    chk(t, L.lineTotal(g1, p1).totalMinor <= L.lineTotal(g2, p1).totalMinor && L.lineTotal(g1, p1).totalMinor <= L.lineTotal(g1, p2).totalMinor, () => `lineTotal ${tag()}`);
    const a = mk(g1, p1), b = mk(g2, p1), c = mk(g1, p2);
    if (a.ok && b.ok) for (const k of ['totalMinor', 'amountDueMinor', 'buyerPaysMinor', 'sellerGetsMinor', 'freightMinor', 'lossGrams', 'sellableGrams'])
      if (k !== 'sellableGrams' || delivery === 'deliver') chk(t, a[k] <= b[k], () => `${k} not monotone in grams ${tag()}: ${a[k]} > ${b[k]}`);
    if (a.ok && c.ok) for (const k of ['totalMinor', 'amountDueMinor', 'buyerPaysMinor', 'sellerGetsMinor', 'buyerLandedPerKgMinor', 'sellerPocketPerKgMinor'])
      chk(t, a[k] <= c[k], () => `${k} not monotone in price ${tag()}: ${a[k]} > ${c[k]}`);
    if (a.ok && c.ok) chk(t, a.freightMinor === c.freightMinor && a.lossGrams === c.lossGrams, () => `freight/loss depend only on grams+route ${tag()}`);
  }
  for (const pid of PACKS) for (const pay of P(pid).payments) for (const side of ['buyerFee', 'sellerFee']) {
    if (!pay[side]) continue;
    let prev = -1; const pts = new Set([0, 1]); for (let x = 1; x < 3e7; x = Math.max(x + 1, Math.floor(x * 1.013))) pts.add(x);
    for (const rule of [pay[side].tiers || []]) for (const tr of rule) if (tr.upTo != null) [tr.upTo - 1, tr.upTo, tr.upTo + 1].forEach(x => x >= 0 && pts.add(x));
    for (const x of [...pts].sort((a, b) => a - b)) { const f = L.feeOf(x, pay[side]).feeMinor; chk(t, f >= prev, () => `${pid}/${pay.id}.${side} fee drops at ${x}: ${prev} -> ${f}`); chk(t, f >= 0 && isInt(f), () => `fee int>=0 at ${x}`); prev = f; }
  }
  for (const pid of PACKS) for (const grade of ['A', 'B', 'C']) {
    let prev = -1; for (let x = 0; x < 5000; x += 7) { const v = L.gradeAdjust(pid, x, grade); chk(t, v >= prev, () => `gradeAdjust monotone ${pid} ${grade} ${x}`); prev = v; }
    chk(t, grade !== 'A' || L.gradeAdjust(pid, 4321, 'A') === 4321, 'grade A adjust is identity');
    chk(t, L.gradeAdjust(pid, 4000, 'C') <= L.gradeAdjust(pid, 4000, 'B') && L.gradeAdjust(pid, 4000, 'B') <= 4000, 'grade order C<=B<=A');
    for (let i = 0; i < 100; i++) { const x = r.int(100, 100000), back = L.gradeAdjust(pid, L.normalizeToGradeA(pid, x, grade), grade); chk(t, Math.abs(back - x) <= 1, () => `normalize/adjust round trip ${pid} ${grade} ${x} -> ${back}`); }
  }
  let prevRank = Infinity; const others = [400, 430, 430, 455, 470];
  for (let x = 380; x <= 500; x++) { const { rank, of } = L.rankOfOffer(x, others); chk(t, rank <= prevRank && rank >= 1 && rank <= of && of === 6, () => `rankOfOffer ${x}`); prevRank = rank; }
  t.done();
}

// ================================================================ 4. containers & unit conversion
{
  const t = suite('props: containers, unit conversion round trips'); const r = mkRng(4);
  for (const pid of PACKS) {
    const p = P(pid);
    for (const c of p.containers) for (const m of [undefined, ...p.markets.map(x => x.id)]) for (const cr of [undefined, ...p.crops.map(x => x.id)]) for (const heaped of [false, true]) {
      const g = L.containerGrams(pid, c.id, { marketId: m, cropId: cr, heaped });
      chk(t, g.ok && isInt(g.grams) && g.grams > 0 && ['market', 'crop', 'default'].includes(g.source) && typeof g.approx === 'boolean', () => `containerGrams ${pid} ${c.id} ${m} ${cr}: ${J(g)}`);
      chk(t, g.approx === (c.approx !== false) && (!g.heaped || g.grams > L.containerGrams(pid, c.id, { marketId: m, cropId: cr }).grams), () => `approx/heaped ${pid} ${c.id}`);
      const calib = 700 + r.int(0, 100000), u = L.containerGrams(pid, c.id, { marketId: m, cropId: cr, heaped, calib: { [c.id]: calib } });
      chk(t, u.ok && u.grams === calib && u.source === 'user' && !u.approx && !u.heaped, () => `calibration wins ${pid} ${c.id}`);
      chk(t, L.containerGrams(pid, c.id, { calib: { [c.id]: 0 } }).source !== 'user' && L.containerGrams(pid, c.id, { calib: { [c.id]: -5 } }).source !== 'user', 'non-positive calibration ignored');
    }
    chk(t, L.containerGrams(pid, 'nope').error === 'UNKNOWN_CONTAINER', 'unknown container');
    for (const c of p.containers) if (c.byMarket) for (const mid of Object.keys(c.byMarket)) chk(t, L.containerGrams(pid, c.id, { marketId: mid }).grams === c.byMarket[mid].grams, `byMarket ${c.id}/${mid}`);
    for (const c of p.containers) if (c.byCrop) for (const cid of Object.keys(c.byCrop)) chk(t, L.containerGrams(pid, c.id, { cropId: cid }).grams === c.byCrop[cid].grams, `byCrop ${c.id}/${cid}`);
  }
  chk(t, L.containerGrams('ng-kano', 'mudu', { marketId: 'kaduna' }).grams * 2 === L.containerGrams('ng-kano', 'mudu', { marketId: 'dawanau' }).grams, 'Kano mudu is twice Kaduna mudu (flat)');
  for (let i = 0; i < 4000; i++) {
    const gpc = r.pick([r.logInt(300, 3000), r.logInt(1000, 120000)]), price = r.logInt(1, 1e6);
    const pc = L.perContainerFromPerKg(price, gpc), back = L.perKgFromPerContainer(pc.pricePerContainerMinor, gpc);
    chk(t, pc.ok && back.ok && isInt(pc.pricePerContainerMinor) && pc.pricePerContainerMinor >= 0, () => `per-container ${price} @ ${gpc}`);
    const slack = gpc >= 1000 ? 0 : Math.floor(500 / gpc + 0.5);
    chk(t, Math.abs(back.priceMinorPerKg - price) <= slack, () => `perKg round trip ${price}@${gpc}: back=${back.priceMinorPerKg} slack=${slack}`);
    chk(t, pc.pricePerContainerMinor === bdiv(BigInt(price) * BigInt(gpc), 1000), () => `perContainer formula ${price}@${gpc}`);
    const price2 = price + r.int(0, 5000);
    chk(t, L.perKgFromPerContainer(price, gpc).priceMinorPerKg <= L.perKgFromPerContainer(price2, gpc).priceMinorPerKg && L.perContainerFromPerKg(price, gpc).pricePerContainerMinor <= L.perContainerFromPerKg(price2, gpc).pricePerContainerMinor, () => `per-container conversions monotone in price`);
    // quantities: N whole containers is exactly N*gpc grams; tenths are monotone; grams -> tenths -> grams stays within half a tenth
    const whole = r.int(0, 500); chk(t, L.toGrams(whole * 10, gpc).grams === whole * gpc, () => `toGrams whole containers ${whole}x${gpc}`);
    const q = r.int(0, 100000), q2 = q + r.int(0, 100);
    chk(t, L.toGrams(q, gpc).grams <= L.toGrams(q2, gpc).grams, () => `toGrams monotone qty`);
    const grams = r.logInt(1000, 5e6), tenths = bdiv(BigInt(grams) * 10n, gpc), again = L.toGrams(tenths, gpc);
    chk(t, again.ok && Math.abs(again.grams - grams) <= Math.floor(gpc / 20) + 1, () => `grams->tenths->grams ${grams}@${gpc}: ${again.grams}`);
    const total = L.lineTotal(L.toGrams(q, gpc).grams, price).totalMinor, viaContainer = L.perContainerFromPerKg(price, gpc).pricePerContainerMinor * q / 10;
    chk(t, Math.abs(total - viaContainer) <= q / 10 * 0.5 + 1, () => `total via kg vs via container ${q}@${gpc},${price}: ${total} vs ${viaContainer}`);
  }
  chk(t, L.toGrams(1e9, 100000).error === 'OVERFLOW' && L.toGrams(-1, 100).error === 'BAD_INPUT' && L.toGrams(1.5, 100).error === 'BAD_INPUT' && L.toGrams(5, 0).error === 'BAD_INPUT', 'toGrams errors');
  for (let i = 0; i < 500; i++) { // handshake: symmetric, zero when equal, monotone in the gap
    const a = r.logInt(300, 130000), b = r.logInt(300, 130000), u = L.unitMismatch('ng-kano', a, b, { qtyTenths: 100, priceMinorPerKg: 450 }), v = L.unitMismatch('ng-kano', b, a, { qtyTenths: 100, priceMinorPerKg: 450 });
    chk(t, u.diffBps === v.diffBps && u.level === v.level && u.totalDiffMinor === v.totalDiffMinor && u.diffBps >= 0, () => `unitMismatch symmetric ${a},${b}`);
    chk(t, u.level === (u.diffBps > 1000 ? 'red' : u.diffBps > 200 ? 'yellow' : 'ok') && (a !== b || (u.diffBps === 0 && u.totalDiffMinor === 0)), () => `unitMismatch level ${a},${b}: ${J(u)}`);
  }
  t.done();
}

// ================================================================ 5. fees, change, basket
{
  const t = suite('props: fee cliffs, change, basket'); const r = mkRng(5);
  for (const pid of PACKS) for (const pay of P(pid).payments) for (const side of ['buyerFee', 'sellerFee']) {
    const rule = pay[side]; if (!rule || (!rule.tiers && !rule.addOn)) continue;
    for (let i = 0; i < 1500; i++) {
      const x = r.logInt(1, 200000), cl = L.feeCliff(x, rule), f = a => L.feeOf(a, rule).feeMinor;
      chk(t, cl.ok, 'feeCliff ok');
      if (cl.above) { chk(t, f(x - cl.above.reduceBy) === f(x) - cl.above.saves && cl.above.saves > 0 && cl.above.reduceBy > 0 && cl.above.reduceBy <= Math.floor(x * 300 / 10000), () => `${pid}/${pay.id} above-hint wrong at ${x}: ${J(cl.above)}`); chk(t, f(cl.above.atOrBelow) === f(x - cl.above.reduceBy), 'atOrBelow consistent'); }
      if (cl.below) chk(t, f(x + cl.below.raiseBy) === f(x) + cl.below.costs && cl.below.costs > 0 && cl.below.raiseBy > 0 && cl.below.raiseBy <= Math.floor(x * 300 / 10000), () => `${pid}/${pay.id} below-hint wrong at ${x}: ${J(cl.below)}`);
    }
  }
  eqDeep(t, L.feeCliff(10020, P('ng-kano').payments[1].buyerFee), { ok: true, above: { atOrBelow: 9999, reduceBy: 21, saves: 50 }, below: null }, 'documented cliff example');
  for (const [a, b] of [[0, 0], [1, 5], [4999, 5000], [5000, 5001], [9999, 10000], [50000, 50001]]) chk(t, L.feeOf(a, P('ng-kano').payments[1].buyerFee).feeMinor <= L.feeOf(b, P('ng-kano').payments[1].buyerFee).feeMinor, `NG boundary ${a}->${b}`);
  t.eq([0, 5000, 5001, 9999, 10000, 50000, 50001].map(x => L.feeOf(x, P('ng-kano').payments[1].buyerFee).feeMinor), [0, 0, 10, 10, 60, 60, 100], 'NG transfer fee tiers (upTo inclusive)');
  for (let i = 0; i < 3000; i++) {
    const pid = r.pick(PACKS), dens = P(pid).currency.denominations, paid = r.int(0, 5000000), due = r.int(0, 5000000), c = L.makeChange(paid, due, r.shuffle(dens));
    chk(t, c.ok, 'makeChange ok');
    if (paid < due) { chk(t, c.shortMinor === due - paid && c.changeMinor === 0 && c.pieces === 0 && c.breakdown.length === 0, () => `short ${paid}<${due}`); continue; }
    const sum = c.breakdown.reduce((a, b) => a + b.denom * b.count, 0);
    chk(t, c.shortMinor === 0 && c.changeMinor === paid - due && sum + c.remainderMinor === c.changeMinor && c.remainderMinor >= 0 && c.remainderMinor < Math.min(...dens), () => `change arithmetic ${paid}-${due}: ${J(c)}`);
    chk(t, c.pieces === c.breakdown.reduce((a, b) => a + b.count, 0) && sorted(c.breakdown, (a, b) => b.denom - a.denom) && c.breakdown.every(b => dens.includes(b.denom) && b.count > 0), () => `breakdown shape ${J(c)}`);
    const step = Math.min(...dens); if (paid % step === 0 && due % step === 0) chk(t, c.remainderMinor === 0, () => `no remainder on multiples of ${step}: ${paid}-${due}`);
  }
  for (let i = 0; i < 1500; i++) {
    const pid = r.pick(PACKS), p = P(pid), pay = r.pick(p.payments), n = r.int(1, 6);
    const lines = Array.from({ length: n }, () => ({ cropId: r.pick(p.crops).id, grams: r.logInt(100, 2e6), priceMinorPerKg: r.logInt(1, 200000) }));
    const b = L.basket(pid, lines, pay.id, pay.sellerFee ? { userFeeBps: r.int(0, 800) } : undefined);
    chk(t, b.ok, () => `basket ${J(b)}`);
    chk(t, b.totalMinor === lines.reduce((a, l) => a + L.lineTotal(l.grams, l.priceMinorPerKg).totalMinor, 0) && b.lines.length === n, () => `basket total ${J(lines)}`);
    for (const [k, v] of numLeaves(b)) chk(t, isInt(v) && v >= 0, () => `basket ${k}=${v}`);
    chk(t, b.buyerPaysMinor === b.amountDueMinor + b.buyerFeeMinor && b.sellerGetsMinor === b.amountDueMinor - b.sellerFeeMinor && (pay.cashRounding ? b.amountDueMinor % p.currency.cashStep === 0 : b.amountDueMinor === b.totalMinor), () => `basket identity ${J(b)}`);
    chk(t, b.lines.every(l => l.totalMinor <= b.totalMinor), 'each line <= sum');
  }
  eqDeep(t, [L.basket('ng-kano', [], 'cash').error, L.basket('ng-kano', [{ grams: 1, priceMinorPerKg: 1 }], 'zz').error, L.basket('ng-kano', [{ grams: 1000, priceMinorPerKg: 5 }, { grams: -1, priceMinorPerKg: 5 }], 'cash').line], ['EMPTY', 'BAD_PAYMENT', 1], 'basket errors');
  t.done();
}

// ================================================================ 6. no-throw fuzz on scalar inputs
{
  const t = suite('props: garbage scalar input never throws'); const r = mkRng(6);
  const G = [NaN, Infinity, -Infinity, -1, 0, 1, 1.5, 2 ** 53, -(2 ** 53), '5', '', null, undefined, true, {}, [], 1e21, 0.1];
  const fns = {
    lineTotal: 2, toGrams: 2, perKgFromPerContainer: 2, perContainerFromPerKg: 2, luhnCheckDigit: 1, makeListingCode: 1, verifyListingCode: 1, dealCode: 1, parseDealCode: 1,
    bufferValue: 2, fmtKg: 1, fmtClock: 2, agoParts: 1, cellWidth: 1, truncateCells: 2, roundDiv: 2, roundToStep: 3, fmtTpl: 2,
  };
  const withPack = { fmtMoney: 2, unitMismatch: 3, feeOf: 2, feeCliff: 2, gapBand: 2, weighCompare: 1, magnitudeGuard: 2, blindResolve: 1, gradeAdjust: 2, sealedGuard: 2, freshnessOf: 1, displayPrice: 3, distanceKm: 2, freightMinor: 2, freightPerKg: 1, resealBounds: 1 };
  const rule = P('ng-kano').payments[1].buyerFee;
  for (const [fn, n] of Object.entries(fns)) for (let i = 0; i < 300; i++) {
    const args = Array.from({ length: n }, () => r.pick(G));
    let res, threw = null; try { res = L[fn](...args); } catch (e) { threw = e; }
    chk(t, !threw, () => `${fn}(${args.map(a => typeof a === 'string' ? `'${a}'` : a === undefined ? 'undefined' : J(a)).join(', ')}) threw ${threw}`);
    if (!threw && res && typeof res === 'object' && 'ok' in res) chk(t, res.ok === true || (res.ok === false && typeof res.error === 'string'), () => `${fn} bad failure shape ${J(res)}`);
    if (!threw && typeof res === 'number') chk(t, !(res === Infinity || res === -Infinity), () => `${fn} produced Infinity`);
  }
  for (const [fn, n] of Object.entries(withPack)) for (let i = 0; i < 300; i++) {
    const args = Array.from({ length: n - 1 }, () => r.pick(G)); if (fn === 'feeOf' || fn === 'feeCliff') args[1] = r.pick([rule, null, { tiers: [] }, {}]);
    if (fn === 'weighCompare' || fn === 'blindResolve' || fn === 'resealBounds') args[0] = { a: r.pick(G), b: r.pick(G), priceMinorPerKg: r.pick(G), floor: r.pick(G), ceiling: r.pick(G), role: r.pick(['S', 'B', 'X']), prev: r.pick(G) };
    let res, threw = null; try { res = L[fn]('ng-kano', ...args); } catch (e) { threw = e; }
    chk(t, !threw, () => `${fn}(pack, ${J(args)}) threw ${threw}`);
    if (!threw && res && typeof res === 'object' && 'ok' in res) chk(t, res.ok === true || (res.ok === false && typeof res.error === 'string'), () => `${fn} bad failure shape ${J(res)}`);
  }
  for (const g of [null, undefined, {}, 'x']) { let threw = false; try { L.makeChange(g, g, [1]); } catch (e) { threw = true; } chk(t, !threw, 'makeChange with junk amounts must not throw'); }
  t.done();
}

// ================================================================ 7. codes, buffer, format
{
  const t = suite('props: codes, input buffer, formatting'); const r = mkRng(7);
  // Luhn listing codes: every valid seq round-trips; every single-digit corruption is caught
  for (let s = 0; s <= 9999; s++) {
    const c = L.makeListingCode(s), v = L.verifyListingCode(c);
    chk(t, /^\d{5}$/.test(c) && v.ok && v.seq === s, () => `listing code ${s} -> ${c} -> ${J(v)}`);
    if (s % 7 === 0) for (let pos = 0; pos < 5; pos++) { const d = r.int(1, 9), bad = c.slice(0, pos) + ((Number(c[pos]) + d) % 10) + c.slice(pos + 1); chk(t, !L.verifyListingCode(bad).ok, () => `single-digit error not caught ${c} -> ${bad}`); }
  }
  chk(t, L.makeListingCode(7392) === '73924' && L.makeListingCode(-1) === null && L.makeListingCode(10000) === null && L.makeListingCode(1.5) === null, 'listing code anchors');
  chk(t, L.verifyListingCode('7392').error === 'BAD_FORMAT' && L.verifyListingCode('7392x').error === 'BAD_FORMAT' && L.verifyListingCode('73925').error === 'BAD_CHECK_DIGIT', 'verifyListingCode errors');
  // deal codes: round trip; the verifier only depends on (no mod 100), so typos in the last 4 digits are always caught, typos in the first 2 never are
  const caught = [0, 0, 0, 0, 0, 0], total = [0, 0, 0, 0, 0, 0];
  for (let n = 0; n <= 9999; n++) {
    const c = L.dealCode(n), v = L.parseDealCode(c); chk(t, /^\d{6}$/.test(c) && v.ok && v.offerNo === n, () => `deal code ${n}`);
    if (n % 11 === 0) for (let pos = 0; pos < 6; pos++) { const bad = c.slice(0, pos) + ((Number(c[pos]) + 1 + (n % 9)) % 10) + c.slice(pos + 1); total[pos]++; if (!L.parseDealCode(bad).ok) caught[pos]++; }
  }
  for (let pos = 2; pos < 6; pos++) chk(t, caught[pos] === total[pos], () => `deal code single-digit typo at position ${pos}: caught ${caught[pos]}/${total[pos]}`);
  chk(t, L.dealCode(4821) === '482188' && L.parseDealCode('482188').offerNo === 4821 && L.parseDealCode('482189').error === 'BAD_VERIFIER' && L.parseDealCode('48218').error === 'BAD_FORMAT', 'deal code anchors');
  chk(t, L.luhnCheckDigit('7392') === 4 && L.luhnCheckDigit('12a') === null, 'luhn anchors');

  // bufferPush: whatever key sequence, the buffer stays a well-formed decimal within limits and bufferValue agrees
  const KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '*', 'BACK', 'CLEAR', 'x', '#', 'Enter'];
  for (let i = 0; i < 3000; i++) {
    const opts = { maxLen: r.int(1, 9), maxDecimals: r.int(0, 3) }; let buf = '';
    for (let k = 0; k < 14; k++) {
      const key = r.pick(KEYS), next = L.bufferPush(buf, key, opts);
      chk(t, /^(|0|[1-9]\d*|(0|[1-9]\d*)\.\d*)$/.test(next), () => `buffer malformed '${buf}' + ${key} -> '${next}' ${J(opts)}`);
      chk(t, next.length <= Math.max(opts.maxLen, buf.length), () => `buffer over maxLen '${next}' ${J(opts)}`);
      if (next.includes('.')) chk(t, next.length - next.indexOf('.') - 1 <= opts.maxDecimals && opts.maxDecimals > 0, () => `too many decimals '${next}' ${J(opts)}`);
      if (key === 'CLEAR') chk(t, next === '', 'CLEAR');
      if (key === 'BACK') chk(t, next === buf.slice(0, -1), 'BACK');
      if (!/^[0-9*]$|^BACK$|^CLEAR$/.test(key)) chk(t, next === buf, `unknown key ${key} ignored`);
      buf = next;
      if (buf !== '' && buf !== '.') {
        const dec = opts.maxDecimals, v = L.bufferValue(buf, dec), [w, f = ''] = buf.split('.');
        const expect = BigInt(w || '0') * 10n ** BigInt(dec) + BigInt(f.padEnd(dec, '0') || '0');
        chk(t, v.ok && BigInt(v.scaled) === expect, () => `bufferValue('${buf}',${dec}) = ${J(v)} want ${expect}`);
      }
    }
  }
  t.eq([L.bufferPush('0', '5'), L.bufferPush('0', '0'), L.bufferPush('', '*', { maxDecimals: 1 }), L.bufferPush('', '*', { maxDecimals: 0 }), L.bufferPush('1.', '5', { maxDecimals: 1 }), L.bufferPush('1.5', '5', { maxDecimals: 1 })], ['5', '0', '0.', '', '1.5', '1.5'], 'buffer anchors');
  t.eq([L.bufferValue('', 0).error, L.bufferValue('.', 1).error, L.bufferValue('1.234', 2).error, L.bufferValue('5.', 2).scaled], ['EMPTY', 'EMPTY', 'TOO_MANY_DECIMALS', 500], 'bufferValue anchors');

  // money / weight / time formatting
  for (let i = 0; i < 4000; i++) {
    const pid = r.pick(PACKS), c = P(pid).currency, m = r.logInt(0, 5e10) * (r.f() < 0.1 ? -1 : 1), s = L.fmtMoney(pid, m), body = s.replace(c.symbol, '').replace('-', '');
    chk(t, s.startsWith((m < 0 ? '-' : '') + c.symbol), () => `fmtMoney prefix ${s}`);
    chk(t, c.grouping === 'indian' ? /^(\d{1,3}|\d{1,2}(,\d{2})*,\d{3})(\.\d{2})?$/.test(body) : /^\d{1,3}(,\d{3})*$/.test(body), () => `fmtMoney grouping ${pid} ${m} -> ${s}`);
    const [w, f = ''] = body.replace(/,/g, '').split('.'); chk(t, (BigInt(w) * BigInt(c.minorPerMajor) + BigInt(f.padEnd(c.decimals, '0') || '0')) * (m < 0 ? -1n : 1n) === BigInt(m), () => `fmtMoney parse-back ${pid} ${m} -> ${s}`);
    if (c.decimals > 0 && m % c.minorPerMajor === 0) chk(t, !s.includes('.'), () => `whole amounts have no decimals ${s}`);
    const g = r.logInt(0, 2e8), kg = L.fmtKg(g); chk(t, /^\d+(\.\d{1,2})?$/.test(kg) && !/\.\d*0$/.test(kg) && Math.abs(Number(kg) * 1000 - g) <= 5, () => `fmtKg ${g} -> ${kg}`);
    const age = r.logInt(0, 2e9), a = L.agoParts(age);
    const unitMs = { now: 1, min: 60000, h: HOUR, d: DAY }[a.unit];
    chk(t, a.unit === 'now' ? age < 60000 && a.n === 0 : a.n >= 1 && a.n * unitMs <= age && age < (a.n + 1) * unitMs && (a.unit === 'min' ? a.n < 60 : a.unit === 'h' ? a.n < 24 : true), () => `agoParts ${age} -> ${J(a)}`);
    const ck = L.fmtClock(r.int(0, 2e12), r.pick([0, 60, 330, -300, 600])); chk(t, /^([01]\d|2[0-3]):[0-5]\d$/.test(ck), () => `fmtClock ${ck}`);
  }
  chk(t, L.fmtClock(T0, 60) === '06:30' && L.fmtClock(T0, 330) === '11:00' && L.fmtClock(T0, 0) === '05:30', 'fmtClock anchors');
  chk(t, L.fmtMoney('ng-kano', NaN) === '—' && L.fmtMoney('in-bihar', 12345678) === '₹1,23,456.78' && L.fmtMoney('in-bihar', 1800) === '₹18' && L.fmtKg(1130) === '1.13' && L.fmtKg(null) === '—', 'format anchors');
  // agoParts is monotone in age (unit order)
  let last = -1; for (const age of [0, 59999, 60000, 3599999, 3600000, 86399999, 86400000, 5 * DAY]) { const a = L.agoParts(age), rank = { now: 0, min: 1, h: 2, d: 3 }[a.unit]; chk(t, rank >= last, `agoParts unit order at ${age}`); last = rank; }
  // fmtTpl
  t.eq([L.fmtTpl('a {x} {y} {n}', { x: 0, n: 'q' }), L.fmtTpl('{a}{a}', { a: 1 }), L.fmtTpl('none', null), L.fmtTpl('{k}', {})], ['a 0 {y} q', '11', 'none', '{k}'], 'fmtTpl');
  // cell widths (BMP text only: truncateCells splits surrogate pairs, see LOGIC_API K2)
  const ALPHABET = Array.from('0123456789abcXYZ@%&₦₹,.:-/ 番茄公斤市場價格→○●…हिन्दी');
  for (let i = 0; i < 2500; i++) {
    const s = Array.from({ length: r.int(0, 20) }, () => r.pick(ALPHABET)).join(''), n = r.int(0, 30), tr = L.truncateCells(s, n);
    chk(t, s.startsWith(tr) && L.cellWidth(tr) <= n + 0.0001 + 0.1, () => `truncateCells('${s}',${n}) = '${tr}' width ${L.cellWidth(tr)}`);
    if (tr.length < s.length) chk(t, L.cellWidth(tr + s[tr.length]) > n - 0.0001, () => `truncateCells not maximal '${s}',${n}`);
    chk(t, L.cellWidth(s) >= 0 && (s === '' ? L.cellWidth(s) === 0 : L.cellWidth(s) >= s.length * 0.99) && L.cellWidth(s) <= s.length * 2 + 0.1, () => `cellWidth range '${s}'`);
    const s2 = Array.from({ length: 5 }, () => r.pick(ALPHABET)).join(''); chk(t, L.cellWidth(s + s2) <= L.cellWidth(s) + L.cellWidth(s2) + 0.11 && L.cellWidth(s + s2) >= L.cellWidth(s), () => `cellWidth additivity '${s}' + '${s2}'`);
  }
  t.eq([L.cellWidth('番茄 126kg'), L.cellWidth('AAA'), L.truncateCells('番茄 126kg ₦470/kg', 8)], [10, 4.2, '番茄 126'], 'cellWidth anchors');
  // viewLint
  chk(t, L.viewLint({ title: 'x' }, '1x1').issues[0] === 'UNKNOWN_SIZE', 'viewLint unknown size');
  for (const size of Object.keys(D.sizes)) {
    const S = D.sizes[size];
    chk(t, L.viewLint({ title: 'ok', rows: Array.from({ length: S.rows }, () => ({ t: '1' })), softkeys: { l: 'a', c: 'b', r: 'c' } }, size).ok, `viewLint full-height view fits ${size}`);
    chk(t, L.viewLint({ title: 'ok', rows: Array.from({ length: S.rows + 1 }, () => ({ t: '1' })) }, size).issues.some(x => x.startsWith('TOO_MANY_ROWS')), `viewLint row overflow ${size}`);
    chk(t, L.viewLint({ title: 'ok', rows: [{ t: 'x'.repeat(S.cols + 1) }] }, size).issues.includes('ROW_0_TOO_WIDE'), `viewLint wide row ${size}`);
    chk(t, L.viewLint({ title: 'ok', rows: [{ t: 'x'.repeat(Math.floor(S.cols / 2) + 1), big: true }] }, size).issues.includes('ROW_0_TOO_WIDE'), `viewLint big row is half width ${size}`);
    for (const bad of ['undefined', 'NaN', 'Infinity', '[object Object]', '{{x}}']) chk(t, L.viewLint({ title: 'ok', rows: [{ t: 'a ' + bad }] }, size).issues.includes('ROW_0_BAD_TEXT'), `viewLint bad text ${bad} ${size}`);
  }
  t.done();
}

// ================================================================ 8. pack structure
{
  const t = suite('props: pack structure (both regions complete and cross-referenced)');
  const str = v => typeof v === 'string' && v.trim().length > 0, pint = v => isInt(v) && v > 0, nint = v => isInt(v) && v >= 0;
  const names = (o, langs = ['zh', 'en']) => o && langs.every(l => str(o[l]));
  const keySet = o => Object.keys(o).sort().join(',');
  chk(t, PACKS.length >= 2 && PACKS.every(id => P(id) && P(id).id === id), 'packOrder lists real packs whose id matches');
  chk(t, Object.keys(D.packs).every(id => PACKS.includes(id)), 'every pack is in packOrder');
  chk(t, keySet(P(PACKS[0])) === keySet(P(PACKS[1])), () => `top-level pack keys differ: ${keySet(P(PACKS[0]))} vs ${keySet(P(PACKS[1]))}`);
  chk(t, D.schemaVersion === 1 && J(D.langs) === '["zh","en"]', 'schemaVersion/langs');
  for (const pid of PACKS) {
    const p = P(pid), tag = m => `${pid}: ${m}`, cur = p.currency;
    for (const k of ['id', 'version', 'simulated', 'names', 'defaultLang', 'currency', 'tz', 'startLocal', 'readbackMinMajor', 'minGrams', 'grades', 'gradeBps', 'deliveries', 'lossCapBps', 'resaleUpliftBps', 'markets', 'distKm', 'freight', 'crops', 'prices', 'priceSourceLabel', 'containers', 'payments', 'ref', 'negotiation', 'display', 'seed']) chk(t, p[k] !== undefined && p[k] !== null, tag(`missing ${k}`));
    chk(t, p.simulated === true && names(p.names) && names(p.priceSourceLabel) && D.langs.includes(p.defaultLang.A) && D.langs.includes(p.defaultLang.B), tag('names/simulated/defaultLang'));
    chk(t, str(cur.code) && str(cur.symbol) && pint(cur.minorPerMajor) && cur.minorPerMajor === 10 ** cur.decimals && ['intl', 'indian'].includes(cur.grouping) && pint(cur.cashStep) && pint(cur.priceStep) && cur.priceStepBig % cur.priceStep === 0, tag('currency'));
    chk(t, cur.denominations.every(pint) && sorted(cur.denominations, (a, b) => b - a) && new Set(cur.denominations).size === cur.denominations.length && Math.min(...cur.denominations) === cur.cashStep && cur.denominations.every(d => d % cur.cashStep === 0), tag('denominations descending, smallest = cashStep, all multiples'));
    chk(t, isInt(p.tz.offsetMin) && str(p.tz.label) && p.startLocal.h >= 0 && p.startLocal.h < 24 && p.startLocal.m >= 0 && p.startLocal.m < 60, tag('tz/startLocal'));
    chk(t, pint(p.readbackMinMajor) && p.minGrams === 1000 && J(p.grades) === '["A","B","C"]' && p.gradeBps.A === 0 && p.gradeBps.B < 0 && p.gradeBps.C < p.gradeBps.B && p.gradeBps.C > -10000 && J(p.deliveries) === '["pickup","deliver"]' && pint(p.lossCapBps) && p.lossCapBps < 10000 && nint(p.resaleUpliftBps), tag('shared settings'));
    chk(t, ['minorPerTonKm', 'minMinor', 'typicalLoadGrams'].every(k => pint(p.freight[k])), tag('freight'));
    // markets & distances
    const mids = p.markets.map(m => m.id);
    chk(t, new Set(mids).size === mids.length && mids.length >= 3 && p.markets.every(m => str(m.id) && names(m.names, ['zh', 'en', 'local']) && pint(m.multBps)), tag('markets'));
    const want = mids.length * (mids.length - 1) / 2;
    chk(t, Object.keys(p.distKm).length === want, tag(`distKm covers all ${want} market pairs (got ${Object.keys(p.distKm).length})`));
    for (const [k, v] of Object.entries(p.distKm)) { const [a, b] = k.split('|'); chk(t, mids.includes(a) && mids.includes(b) && a < b && pint(v), tag(`distKm key ${k} must be two known ids in alphabetical order`)); }
    for (const a of mids) for (const b of mids) { const d = L.distanceKm(pid, a, b); chk(t, a === b ? d === 0 : pint(d) && d === L.distanceKm(pid, b, a), tag(`distanceKm ${a},${b}`)); }
    // containers
    const cids = p.containers.map(c => c.id), cropIds = p.crops.map(c => c.id);
    chk(t, new Set(cids).size === cids.length && cids.includes('kg') && p.containers.find(c => c.id === 'kg').grams === 1000, tag('containers unique, kg=1000 g'));
    for (const c of p.containers) {
      chk(t, names(c.names, ['zh', 'en', 'local']) && pint(c.grams) && typeof c.approx === 'boolean' && (c.heapedGrams == null || c.heapedGrams > c.grams), tag(`container ${c.id}`));
      for (const [m, v] of Object.entries(c.byMarket || {})) chk(t, mids.includes(m) && pint(v.grams) && (v.heapedGrams == null || v.heapedGrams > v.grams), tag(`container ${c.id}.byMarket.${m}`));
      for (const [cr, v] of Object.entries(c.byCrop || {})) chk(t, cropIds.includes(cr) && pint(v.grams), tag(`container ${c.id}.byCrop.${cr}`));
    }
    // crops
    chk(t, J(p.crops.map(c => c.key)) === J([1, 2, 3, 4, 5, 6, 7, 8, 9]) && new Set(cropIds).size === 9, tag('9 crops with keys 1..9 (home grid) and unique ids'));
    for (const c of p.crops) {
      chk(t, str(c.id) && names(c.names, ['zh', 'en', 'local']) && ['perishable', 'normal', 'durable'].includes(c.perishClass) && nint(c.lossBpsPer100km) && pint(c.leaseHours) && pint(c.refWindowDays), tag(`crop ${c.id} scalars`));
      chk(t, c.containers.length >= 2 && c.containers.every(x => cids.includes(x)) && c.containers.includes('kg') && c.containers.includes(c.defaultContainer) && c.defaultContainer !== 'kg', tag(`crop ${c.id} containers/defaultContainer`));
      chk(t, D.gradeCards[c.perishClass] != null, tag(`gradeCard for ${c.perishClass}`));
      const pr = p.prices[c.id]; chk(t, pr && pr.series.length === 7 && pr.series.every(pint) && nint(pr.asOfAgoMin), tag(`prices[${c.id}]`));
      for (const m of mids) { const e = L.externalPrice(pid, c.id, m, T0); chk(t, e.ok && pint(e.priceMinorPerKg) && e.priceMinorPerKg % cur.priceStep === 0 && e.series.length === 7 && e.simulated === true && e.asOf < T0 && isInt(e.trend7dBps), tag(`externalPrice ${c.id}@${m}: ${J(e)}`)); }
      chk(t, L.respondMsFor(pid, c.id) === p.negotiation.respondMinutesByClass[c.perishClass] * 60000 && L.leaseMs(pid, c.id) === c.leaseHours * HOUR, tag(`respondMsFor/leaseMs ${c.id}`));
      chk(t, (c.perishClass === 'perishable') === (c.refWindowDays === 3), tag(`perishable crops use the 3-day window (${c.id})`));
    }
    chk(t, Object.keys(p.prices).length === 9 && Object.keys(p.prices).every(k => cropIds.includes(k)), tag('prices has no orphan keys'));
    // payments & fee rules
    const pids = p.payments.map(x => x.id);
    chk(t, new Set(pids).size === pids.length && pids.includes('cash') && p.payments.find(x => x.id === 'cash').cashRounding === true && p.payments.filter(x => x.id !== 'cash').every(x => x.cashRounding === false), tag('payments: unique, only cash rounds'));
    for (const py of p.payments) {
      chk(t, names(py.names) && py.meta && str(py.meta.status), tag(`payment ${py.id} names/meta`));
      for (const side of ['buyerFee', 'sellerFee']) {
        const r = py[side]; if (r === null) continue;
        chk(t, typeof r === 'object', tag(`${py.id}.${side} object|null`));
        if (r.tiers) { const ups = r.tiers.map(x => x.upTo); chk(t, ups.slice(0, -1).every((u, i) => pint(u) && (i === 0 || u > ups[i - 1])) && ups[ups.length - 1] === null && r.tiers.every(x => nint(x.fee)), tag(`${py.id}.${side}.tiers ascending, last upTo null`)); }
        if (r.addOn) chk(t, r.addOn.every((x, i) => pint(x.from) && nint(x.fee) && (i === 0 || x.from > r.addOn[i - 1].from)), tag(`${py.id}.${side}.addOn ascending`));
        if (r.percentBps != null) chk(t, nint(r.percentBps) && r.percentBps <= 10000, tag(`${py.id}.${side}.percentBps`));
        if (r.minFee != null && r.maxFee != null) chk(t, r.minFee <= r.maxFee, tag('min<=max fee'));
        chk(t, r.tiers || r.addOn || r.percentBps != null, tag(`${py.id}.${side} has at least one component`));
      }
    }
    // negotiation & ref
    const N = p.negotiation, R = p.ref;
    chk(t, N.maxTurns === 5 && N.finalFromTurn >= 2 && N.finalFromTurn <= N.maxTurns && N.maxChangedFields === 2 && nint(N.maxReopens) && pint(N.sheetTtlHours) && pint(N.trustedWindowMin) && N.magnitudeFactor >= 2 && nint(N.exitFrictionBps) && N.exitFrictionBps < 10000, tag('negotiation scalars'));
    chk(t, ['perishable', 'normal', 'durable'].every(k => pint(N.respondMinutesByClass[k])) && N.respondMinutesByClass.perishable < N.respondMinutesByClass.normal && N.respondMinutesByClass.normal < N.respondMinutesByClass.durable, tag('respond windows grow with shelf life'));
    chk(t, N.coachRatiosBps.length >= 1 && N.coachRatiosBps.every(x => x > 0 && x < 10000) && sorted(N.coachRatiosBps, (a, b) => b - a), tag('coach concession ratios shrink'));
    chk(t, N.blind.gapSmallBps < N.blind.gapMediumBps && pint(N.blind.maxRounds) && N.blind.resealMaxConcedeBps > 0 && N.weigh.greenBps < N.weigh.yellowBps && pint(N.reputationMinN) && pint(N.smsPerThreadPerDay), tag('blind/weigh/reputation thresholds'));
    chk(t, R.minTrades >= 1 && R.quantiles.low[0] / R.quantiles.low[1] < R.quantiles.mid[0] / R.quantiles.mid[1] && R.quantiles.mid[0] / R.quantiles.mid[1] < R.quantiles.high[0] / R.quantiles.high[1] && R.freshHours < R.agingHours && R.agingHours < R.oldHours && pint(R.sizeCapKg) && R.decayFloorPermille > 0 && R.decayFloorPermille < 1000 && R.concentrationPct > 0 && R.concentrationPct < 100 && R.sourceSpreadBps * R.staleSpreadMult < 10000, tag('ref parameters'));
    chk(t, pint(p.display.agingStep) && p.display.agingStep % cur.priceStep === 0, tag('display.agingStep multiple of priceStep'));
    // seed
    const S = p.seed, uids = S.users.map(u => u.id), known = new Set(uids);
    chk(t, new Set(uids).size === uids.length && S.users.every(u => str(u.name) && ['S', 'B'].includes(u.role) && mids.includes(u.marketId) && /^\d{4}$/.test(u.stallCode) && typeof u.smsOptIn === 'boolean' && str(u.phone) && Object.values(u.rep).every(nint) && u.rep.weighOk <= u.rep.weighChecks && u.rep.onTime <= u.rep.deals && u.rep.ghosts <= u.rep.deals), tag('seed.users'));
    chk(t, known.has(S.personas.A) && known.has(S.personas.B) && S.users.find(u => u.id === S.personas.A).role === 'S' && S.users.find(u => u.id === S.personas.B).role === 'B', tag('personas: A is a seller, B a buyer'));
    for (const [sid, list] of Object.entries(S.circle)) chk(t, known.has(sid) && list.every(x => known.has(x)), tag(`circle ${sid}`));
    chk(t, S.trades.length >= 5 && S.trades.every(x => cropIds.includes(x.cropId) && mids.includes(x.marketId) && nint(x.agoMin) && pint(x.grams) && pint(x.price) && p.grades.includes(x.grade) && str(x.sellerId) && str(x.buyerId)), tag('seed.trades'));
    chk(t, S.listings.every(x => str(x.id) && cropIds.includes(x.cropId) && mids.includes(x.marketId) && p.crops.find(c => c.id === x.cropId).containers.includes(x.containerId) && pint(x.qtyTenths) && pint(x.askMinorPerKg) && p.grades.includes(x.grade) && ['public', 'trusted'].includes(x.audience) && nint(x.ageMin) && str(x.sellerId)) && new Set(S.listings.map(x => x.id)).size === S.listings.length, tag('seed.listings'));
    chk(t, S.wants.every(x => str(x.id) && cropIds.includes(x.cropId) && mids.includes(x.marketId) && pint(x.grams) && pint(x.bidMinorPerKg) && p.grades.includes(x.minGrade) && p.deliveries.includes(x.delivery) && pids.includes(x.payment) && str(x.buyerId) && pint(x.expiresInH)) && new Set(S.wants.map(x => x.id)).size === S.wants.length, tag('seed.wants'));
    chk(t, S.bots.length >= 1 && S.bots.every(b => known.has(b.userId) && b.cropIds.every(c => cropIds.includes(c)) && b.openBps < b.maxBps && b.maxBps <= 10000 && pint(b.maxGrams) && nint(b.firstOfferDelayMin) && nint(b.respondDelayMin)), tag('seed.bots'));
    // every seed listing can be priced end to end for a buyer in each market
    for (const l of S.listings) for (const m of mids) { const g = L.toGrams(l.qtyTenths, L.containerGrams(pid, l.containerId, { marketId: l.marketId, cropId: l.cropId }).grams).grams; const s = L.dealSheet(pid, { grams: g, priceMinorPerKg: l.askMinorPerKg, grade: l.grade, delivery: 'pickup', payment: 'cash' }, { cropId: l.cropId, originMarketId: l.marketId, buyerMarketId: m }); chk(t, s.ok, tag(`seed listing ${l.id} -> ${m}: ${J(s)}`)); }
  }
  // grade cards
  for (const [cls, gc] of Object.entries(D.gradeCards)) chk(t, ['perishable', 'normal', 'durable'].includes(cls) && pint(gc.sample) && gc.maxBad.A <= gc.maxBad.B && gc.maxBad.B <= gc.maxBad.C && names(gc.unit) && ['zh', 'en'].every(l => ['A', 'B', 'C'].every(g => str(gc.text[l][g]))), `gradeCard ${cls}`);
  chk(t, Object.keys(D.gradeCards).length === 3, 'three grade cards');
  for (const [k, v] of Object.entries(D.sizes)) chk(t, pint(v.cols) && pint(v.rows) && pint(v.w) && pint(v.h) && v.rows * v.lineH <= v.h, `size ${k}`);
  chk(t, Object.keys(D.sizes).sort().join() === '128x160,240x320' && D.sizes['240x320'].cols === 26 && D.sizes['128x160'].cols === 17, 'the two screen sizes');
  chk(t, ['ok', 'flaky', 'down'].every(m => D.serverDefaults.network[m] && nint(D.serverDefaults.network[m].latencyMs)), 'serverDefaults.network modes');
  t.done();
}

// ================================================================ 9. i18n + phrases
{
  const t = suite('props: i18n parity and phrases');
  const zh = D.i18n.zh, en = D.i18n.en, kz = Object.keys(zh), ke = Object.keys(en);
  chk(t, kz.length >= 206, `i18n has at least the 206 starter keys (${kz.length})`);
  eqDeep(t, kz.filter(k => !(k in en)), [], 'keys in zh but not en');
  eqDeep(t, ke.filter(k => !(k in zh)), [], 'keys in en but not zh');
  const ph = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of kz) {
    for (const [lang, tbl] of [['zh', zh], ['en', en]]) {
      const v = tbl[k]; if (v === undefined) continue;
      chk(t, typeof v === 'string' && v.trim().length > 0, () => `i18n.${lang}['${k}'] is empty`);
      chk(t, !/undefined|\[object|\bNaN\b|\{\{|\}\}/.test(v), () => `i18n.${lang}['${k}'] has junk text: ${v}`);
      chk(t, v === v.trim(), () => `i18n.${lang}['${k}'] has leading/trailing space`);
    }
    if (typeof zh[k] === 'string' && typeof en[k] === 'string') chk(t, ph(zh[k]) === ph(en[k]), () => `placeholders differ for '${k}': zh ${ph(zh[k])} vs en ${ph(en[k])}`);
    chk(t, /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(k), () => `odd key name '${k}'`);
  }
  const zhOnlyLatin = kz.filter(k => !/[一-鿿]/.test(zh[k]) && !/^(app\.name|sk\.ok)$/.test(k)); // informative: these zh strings have no Chinese at all
  chk(t, zhOnlyLatin.length < kz.length * 0.25, () => `too many zh strings without any Chinese: ${zhOnlyLatin.slice(0, 8).join(', ')}`);
  // every language really differs somewhere (catches a copy-pasted table)
  chk(t, kz.filter(k => zh[k] === en[k]).length < kz.length * 0.2, 'zh and en tables are not the same text');
  // per-key length lint (informational upper bound: the biggest phone shows 26 cells; short forms .s must fit 17)
  for (const k of kz.filter(k => k.endsWith('.s'))) chk(t, L.cellWidth(zh[k]) <= 17 && L.cellWidth(en[k]) <= 17, () => `short key ${k} exceeds 17 cells: '${zh[k]}' / '${en[k]}'`);

  // phrases: the 12 fixed sentences
  const SPEC = { P01: ['B', '價錢太高了', 'The price is too high'], P02: ['B', '貨色不夠好', 'The quality is not good enough'], P03: ['B', '我買得多，請算量大價', 'I buy a lot, please give a volume price'], P04: ['B', '我付現，馬上付', 'I pay cash, right now'], P05: ['BS', '別處價格更好', 'I can get a better price elsewhere'], P06: ['B', '我要先看貨', 'I want to see the goods first'], P07: ['BS', '秤要一起看', "Let's read the scale together"], P08: ['BS', '明天再談', "Let's talk tomorrow"], P09: ['BS', '這是我的最後價', 'This is my final price'], P10: ['S', '今天剛採收，很新鮮', 'Freshly harvested today'], P11: ['B', '我可以自己來取貨', 'I can pick it up myself'], P12: ['BS', '請打電話給我', 'Please call me'] };
  chk(t, D.phrases.length === 12 && J(D.phrases.map(x => x.id)) === J(Object.keys(SPEC)), `exactly the 12 phrases P01..P12 in order (${D.phrases.map(x => x.id).join(',')})`);
  for (const p of D.phrases) {
    const s = SPEC[p.id]; if (!s) continue;
    chk(t, typeof p.zh === 'string' && p.zh.trim() && typeof p.en === 'string' && p.en.trim(), `${p.id} has zh and en text`);
    eqDeep(t, [p.roles.slice().sort().join(''), p.zh, p.en], [s[0].split('').sort().join(''), s[1], s[2]], `${p.id} matches spec table`);
    chk(t, L.renderPhrase(p.id, 'zh') === p.zh && L.renderPhrase(p.id, 'en') === p.en && L.renderPhrase(p.id, 'zh') !== L.renderPhrase(p.id, 'en'), `${p.id} renders per language`);
    chk(t, L.renderPhrase(p.id, 'fr') === p.en, `${p.id} falls back to English for other languages`);
    chk(t, L.cellWidth(p.zh) <= 26 * 2 && L.cellWidth(p.en) <= 26 * 3, `${p.id} short enough to wrap in 2-3 lines`);
    chk(t, !('needs' in p) === (p.id !== 'P09') && !('check' in p) === (p.id !== 'P05') && !('effect' in p) === (p.id !== 'P12'), `${p.id} special flags only on P09/P05/P12`);
  }
  eqDeep(t, [L.renderPhrase('P99', 'zh'), L.renderPhrase('P99', 'en'), L.renderPhrase('#17', 'zh')], ['#99（更新後可見）', '#99 (update to view)', '#17（更新後可見）'], 'unknown phrase ids degrade gracefully');
  for (const pid of PACKS) {
    const seen = new Set();
    for (const role of ['S', 'B']) for (let turn = 1; turn <= 5; turn++) {
      const ids = L.phrasesFor(pid, role, turn);
      chk(t, ids.every(id => SPEC[id] && SPEC[id][0].includes(role)) && new Set(ids).size === ids.length && sorted(ids, (a, b) => (a < b ? -1 : 1)), () => `phrasesFor ${role} turn ${turn}: ${ids}`);
      chk(t, ids.includes('P09') === (turn + 1 >= P(pid).negotiation.finalFromTurn && SPEC.P09[0].includes(role)), () => `P09 gating ${role} turn ${turn}`);
      chk(t, Object.keys(SPEC).filter(id => SPEC[id][0].includes(role) && id !== 'P09').every(id => ids.includes(id)), () => `all non-final phrases for ${role} offered at turn ${turn}`);
      ids.forEach(id => seen.add(id));
    }
    chk(t, seen.size === 12, `${pid}: all 12 phrases are reachable`);
  }
  // refCheck stamp
  const V = (role, price, exit, fr) => L.phraseRefCheck('ng-kano', { role, priceMinorPerKg: price, exitMinor: exit, freshness: fr });
  eqDeep(t, [V('B', 500, 496, 'fresh'), V('B', 500, 500, 'fresh'), V('B', 500, 510, 'aging'), V('S', 500, 520, 'fresh'), V('S', 500, 480, 'fresh'), V('B', 500, null, 'fresh'), V('B', 500, 400, 'stale'), V('S', 500, 900, 'old'), V('S', 500, 900, 'none')], ['supports', 'unsupported', 'unsupported', 'supports', 'unsupported', 'stale', 'stale', 'stale', 'stale'], 'phraseRefCheck');

  // error codes the logic can return vs e.<CODE> strings
  const src = fs.readFileSync(APP_FILE, 'utf8').match(/<script id="farm-logic"[^>]*>([\s\S]*?)<\/script>/)[1], codes = new Set();
  for (const m of src.matchAll(/(?:err|fail)\('([A-Z_]+)'/g)) codes.add(m[1]);
  for (const m of src.matchAll(/return '([A-Z][A-Z_]{3,})'/g)) codes.add(m[1]);
  const INPUT_LEVEL = new Set(['BAD_INPUT', 'BAD_AMOUNT', 'BAD_NUMBER', 'BAD_FORMAT', 'BAD_CHECK_DIGIT', 'BAD_VERIFIER', 'EMPTY', 'TOO_MANY_DECIMALS', 'NO_SOURCE', 'OVERFLOW', 'UNKNOWN_CONTAINER']);
  const missing = [...codes].filter(c => !INPUT_LEVEL.has(c) && !zh['e.' + c]).sort();
  if (process.env.STRICT_ERR_KEYS) chk(t, missing.length === 0, () => `error codes without e.<CODE> strings: ${missing.join(' ')}`);
  else if (missing.length) console.log(`  note: ${missing.length} logic error codes have no e.<CODE> i18n key yet (STRICT_ERR_KEYS=1 to enforce): ${missing.join(' ')}`);
  for (const k of kz.filter(k => k.startsWith('e.'))) chk(t, k.slice(2) === k.slice(2).toUpperCase(), `error key ${k} uses an upper-case code`);
  t.done();
}

// ================================================================ 10. reference price
{
  const t = suite('props: referencePrice (deals vs external fallback)'); const r = mkRng(10);
  const mkTrade = (p, i, o = {}) => ({ id: 't' + i, cropId: o.cropId || 'tomato', marketId: o.marketId || 'dawanau', at: T0 - (o.ageMs != null ? o.ageMs : r.int(0, 2 * DAY)), grams: r.logInt(1000, 400000), grade: r.pick(['A', 'A', 'B', 'C']), priceMinorPerKg: r.int(380, 520), buyerId: o.buyerId || 'b' + r.int(1, 20), counted: o.counted, ...o.extra });
  const base = { cropId: 'tomato', marketId: 'dawanau', now: T0 };
  const ext = L.externalPrice('ng-kano', 'tomato', 'dawanau', T0);
  for (let i = 0; i < 1500; i++) {
    const n = r.int(0, 6), trades = Array.from({ length: n }, (_, k) => mkTrade('ng-kano', k));
    const noise = [mkTrade('ng-kano', 90, { cropId: 'pepper' }), mkTrade('ng-kano', 91, { marketId: 'kaduna' }), mkTrade('ng-kano', 92, { counted: false }), mkTrade('ng-kano', 93, { ageMs: 3 * DAY }), mkTrade('ng-kano', 94, { ageMs: 3 * DAY + 1000 }), mkTrade('ng-kano', 95, { ageMs: -HOUR })];
    const useExt = r.f() < 0.7, e = useExt ? { ...ext, priceMinorPerKg: r.pick([ext.priceMinorPerKg, ext.priceMinorPerKg + 25]), asOf: T0 - r.pick([0, HOUR, 12 * HOUR, 5 * DAY, 9 * DAY, 30 * DAY]) } : null;
    const a = L.referencePrice('ng-kano', { ...base, trades, external: e }), b = L.referencePrice('ng-kano', { ...base, trades: r.shuffle([...trades, ...noise]), external: e });
    const tag = () => `n=${n} ext=${useExt ? J([e.priceMinorPerKg, T0 - e.asOf]) : 'none'}`;
    chk(t, a.ok, () => `ok ${tag()}`);
    delete b.dealsN; const a2 = clone(a); delete a2.dealsN; // noise entries that are in-window+counted differ only if 3 days minus 0.. (ageMs 3*DAY is out of window; -HOUR is future)
    const inWin = noise.filter(x => x.cropId === 'tomato' && x.marketId === 'dawanau' && x.counted !== false && T0 - x.at >= 0 && T0 - x.at < 3 * DAY).length;
    chk(t, inWin === 0, 'noise set must be entirely excluded');
    eqDeep(t, b, a2, `excluded trades / order do not change the result ${tag()}`);
    if (n >= 3) {
      chk(t, a.state === 'deals' && a.sourceLabel === 'deals' && a.simulated === false && a.n === n && a.dealsN === n && a.gradeBasis === 'A', () => `deals state ${tag()}: ${J(a)}`);
      const vals = trades.map(x => L.normalizeToGradeA('ng-kano', x.priceMinorPerKg, x.grade)), lo = Math.min(...vals), hi = Math.max(...vals);
      chk(t, a.low <= a.mid && a.mid <= a.high, () => `band ordered ${tag()} ${J([a.low, a.mid, a.high])}`);
      chk(t, a.concentrated || (a.low >= lo && a.high <= hi && a.mid >= lo && a.mid <= hi), () => `unconcentrated band inside sample range ${tag()} ${J([lo, hi, a.low, a.mid, a.high])}`);
      chk(t, a.asOf === Math.max(...trades.map(x => x.at)) && a.ageMs === T0 - a.asOf && a.freshness === L.freshnessOf('ng-kano', a.ageMs) && a.stale === false, () => `asOf/age ${tag()}`);
    } else if (useExt) {
      chk(t, a.state === 'external' && a.sourceLabel === 'external' && a.mid === e.priceMinorPerKg && a.asOf === e.asOf && a.simulated === true && a.n === 0 && a.dealsN === n && a.concentrated === false, () => `external fallback ${tag()}: ${J(a)}`);
      const spread = 800 * (a.stale ? 2 : 1); chk(t, a.low === bdiv(e.priceMinorPerKg * (10000 - spread), 10000) && a.high === bdiv(e.priceMinorPerKg * (10000 + spread), 10000) && a.low < a.mid && a.mid < a.high, () => `external spread ${tag()}`);
      chk(t, a.stale === (T0 - e.asOf > 168 * HOUR) && a.freshness === L.freshnessOf('ng-kano', T0 - e.asOf), () => `external staleness ${tag()}`);
    } else chk(t, a.state === 'none' && a.mid === null && a.low === null && a.high === null && a.freshness === 'none' && a.sourceLabel === 'none' && a.stale === true && a.dealsN === n, () => `no data ${tag()}: ${J(a)}`);
  }
  // exactly the threshold: 2 deals -> external, 3 deals -> deals
  const three = [0, 1, 2].map(k => mkTrade('ng-kano', k, { ageMs: HOUR * (k + 1), extra: { priceMinorPerKg: 450 + k, grade: 'A' } }));
  chk(t, L.referencePrice('ng-kano', { ...base, trades: three.slice(0, 2), external: ext }).state === 'external' && L.referencePrice('ng-kano', { ...base, trades: three, external: ext }).state === 'deals', '2 deals fall back, 3 deals do not');
  chk(t, L.referencePrice('ng-kano', { ...base, trades: three.slice(0, 2), external: null }).state === 'none', '2 deals and no external -> none');
  chk(t, L.referencePrice('ng-kano', { ...base, trades: three.slice(0, 2), external: { priceMinorPerKg: 'x', asOf: T0 } }).state === 'none', 'a malformed external price does not count');
  const win = 3 * DAY, edge = [mkTrade('ng-kano', 1, { ageMs: win - 1 }), mkTrade('ng-kano', 2, { ageMs: win }), mkTrade('ng-kano', 3, { ageMs: 0 })];
  chk(t, L.referencePrice('ng-kano', { ...base, trades: edge, external: ext }).state === 'external' && L.referencePrice('ng-kano', { ...base, trades: [...edge, mkTrade('ng-kano', 4, { ageMs: 5 })], external: ext }).state === 'deals', 'window edge: age == window excluded, window-1 included');
  eqDeep(t, L.referencePrice('ng-kano', { ...base, cropId: 'zz' }), { ok: false, error: 'UNKNOWN_CROP' }, 'unknown crop');
  // monotone in prices: shifting every trade up never lowers mid/low/high; concentration widens the band
  for (let i = 0; i < 300; i++) {
    const trades = Array.from({ length: r.int(3, 8) }, (_, k) => mkTrade('ng-kano', k, { extra: { grade: 'A' } })), up = trades.map(x => ({ ...x, priceMinorPerKg: x.priceMinorPerKg + r.int(1, 60) }));
    const a = L.referencePrice('ng-kano', { ...base, trades }), b = L.referencePrice('ng-kano', { ...base, trades: up });
    chk(t, a.mid <= b.mid && a.low <= b.low && a.high <= b.high, () => `shifting all prices up lowered the band ${J([a.low, a.mid, a.high])} -> ${J([b.low, b.mid, b.high])}`);
    const one = trades.map(x => ({ ...x, buyerId: 'same' })), c1 = L.referencePrice('ng-kano', { ...base, trades: one }), spread = trades.map((x, k) => ({ ...x, buyerId: 'b' + k })), c2 = L.referencePrice('ng-kano', { ...base, trades: spread });
    chk(t, c1.concentrated === true && c2.concentrated === false && c1.mid === c2.mid && c1.low <= c2.low && c1.high >= c2.high, () => `concentration widens only the band ${J([c1.low, c1.mid, c1.high])} vs ${J([c2.low, c2.mid, c2.high])}`);
  }
  // grade normalisation goes through priceAEq when supplied
  const withAeq = three.map(x => ({ ...x, priceAEq: 1000 })), rAeq = L.referencePrice('ng-kano', { ...base, trades: withAeq });
  chk(t, rAeq.mid === 1000 && rAeq.low === 1000 && rAeq.high === 1000, 'priceAEq overrides the raw price');
  // freshness & precision-with-age
  let prevRank = -1; const order = ['fresh', 'aging', 'old', 'stale'];
  for (let h = 0; h <= 400; h++) { const f = L.freshnessOf('ng-kano', h * HOUR), k = order.indexOf(f); chk(t, k >= prevRank, () => `freshness regressed at ${h}h`); prevRank = k; }
  t.eq(['ng-kano', 'in-bihar'].map(p => [6, 72, 168].map(h => L.freshnessOf(p, h * HOUR) + '/' + L.freshnessOf(p, h * HOUR + 1))), [['fresh/aging', 'aging/old', 'old/stale'], ['fresh/aging', 'aging/old', 'old/stale']], 'freshness boundaries are inclusive');
  for (const pid of PACKS) for (let i = 0; i < 300; i++) {
    const m = r.int(100, 9999), step = P(pid).display.agingStep, f = L.displayPrice(pid, m, 'fresh'), a = L.displayPrice(pid, m, 'aging'), o = L.displayPrice(pid, m, 'old'), s = L.displayPrice(pid, m, 'stale');
    chk(t, f.minor === m && !f.approx && !f.hidden && a.approx && !a.hidden && a.minor % step === 0 && Math.abs(a.minor - m) * 2 <= step && o.hidden && o.minor === null && s.hidden && s.minor === null, () => `displayPrice ${pid} ${m}`);
  }
  // the simulated PriceSource plugs straight into referencePrice
  for (const pid of PACKS) for (const c of P(pid).crops) for (const m of P(pid).markets) {
    const e = L.externalPrice(pid, c.id, m.id, T0), ref = L.referencePrice(pid, { cropId: c.id, marketId: m.id, now: T0, trades: [], external: e });
    chk(t, ref.ok && ref.state === 'external' && ref.simulated === true && ref.mid === e.priceMinorPerKg && ref.sourceLabel === 'external', () => `external -> ref ${pid} ${c.id}@${m.id}`);
    chk(t, ref.freshness === L.freshnessOf(pid, T0 - e.asOf), 'external freshness follows asOf');
  }
  t.done();
}

// ================================================================ 11. offer state machine
{
  const t = suite('props: offer state machine (every state x event)');
  const CONFIGS = {
    'ng-kano': { pack: 'ng-kano', crop: 'tomato', o: 'dawanau', b: 'sabongari', terms: { grams: 20000, priceMinorPerKg: 440, grade: 'A', delivery: 'pickup', payment: 'cash' }, step: 5, sealed: 450 },
    'in-bihar': { pack: 'in-bihar', crop: 'potato', o: 'hajipur', b: 'patna', terms: { grams: 20000, priceMinorPerKg: 1750, grade: 'A', delivery: 'pickup', payment: 'cash' }, step: 50, sealed: 1800 },
  };
  const ALL_CODES = new Set(['BAD_ACTOR', 'NOT_FOUND', 'STALE_VERSION', 'EXPIRED', 'ILLEGAL_STATE', 'NOT_YOUR_TURN', 'FINAL_LOCKED', 'MAX_TURNS', 'NO_CHANGE', 'TOO_MANY_FIELDS', 'FINAL_TOO_EARLY', 'READBACK_REQUIRED', 'READBACK_MISMATCH', 'ALREADY_CONFIRMED', 'REOPEN_LIMIT', 'LISTING_CLOSED', 'UNKNOWN_ACTION', 'OVER_STOCK', 'GRADE_NOT_OFFERED', 'BAD_TERMS', 'BAD_GRAMS', 'BAD_PRICE', 'BAD_GRADE', 'BAD_DELIVERY', 'BAD_PAYMENT', 'UNKNOWN_CROP', 'UNKNOWN_MARKET_PAIR', 'ALL_LOST']);
  const EFFECT_TYPES = new Set(['RESERVE_STOCK', 'RELEASE_STOCK', 'RECORD_TRADE']);
  const ctxOf = C => ({ pack: C.pack, respondMs: L.respondMsFor(C.pack, C.crop), remainingGrams: 200000, listingGrade: 'A', listingOpen: true, sheetCtx: { cropId: C.crop, originMarketId: C.o, buyerMarketId: C.b }, askMinorPerKg: C.terms.priceMinorPerKg + 30 });
  const META = { id: 'o4821', no: 4821, listingId: 'L-A', sellerId: 'u_s', buyerId: 'u_b' };
  const lastAt = o => o.history[o.history.length - 1].at;

  for (const [cfgName, C] of Object.entries(CONFIGS)) {
    const ctx = ctxOf(C), TE = C.terms, price = d => ({ ...TE, priceMinorPerKg: TE.priceMinorPerKg + d * C.step });
    const go = (o, type, by, extra = {}) => { const cmd = { type, by, at: o ? lastAt(o) + 1000 : T0, baseVer: o ? o.ver : undefined, ...extra }; const res = L.applyAction(o, cmd, ctx); if (!res.ok) throw new Error(`setup ${cfgName} ${type}/${by}: ${res.error}`); return res.offer; };
    const LATE = T0 + 10 * DAY;
    // ---- build one offer per reachable state
    const S = {};
    S.aw_s = go(null, 'OFFER', 'B', { terms: TE, meta: META, phraseId: 'P01' });
    S.aw_b = go(S.aw_s, 'COUNTER', 'S', { terms: price(6) });
    const c3 = go(S.aw_b, 'COUNTER', 'B', { terms: price(2) }); S.aw_s3 = c3;
    S.aw_s_final = go(S.aw_b, 'COUNTER', 'B', { terms: price(2), final: true });
    const c4 = go(c3, 'COUNTER', 'S', { terms: price(4) }); S.aw_b4 = c4;
    S.aw_s5 = go(c4, 'COUNTER', 'B', { terms: price(3) });
    S.acc_s = go(S.aw_s, 'ACCEPT', 'S');
    S.acc_b = go(S.aw_b, 'ACCEPT', 'B');
    S.acc_sealed = go(S.aw_s, 'SEALED_DEAL', 'SYS', { priceMinorPerKg: C.sealed });
    S.dealt = go(S.acc_s, 'CONFIRM', 'B');
    S.dealt2 = go(S.acc_sealed, 'CONFIRM', 'S'); // sealed slip: needs both, so this is still ACCEPTED
    S.decl_aw = go(S.aw_s, 'DECLINE', 'S');
    S.decl_wd = go(S.aw_s, 'DECLINE', 'B'); // the proposer withdraws
    S.decl_acc = go(S.acc_s, 'DECLINE', 'B');
    S.exp_resp_s = L.expireIfDue(S.aw_s, LATE).offer;
    S.exp_resp_b = L.expireIfDue(S.aw_b, LATE).offer;
    S.exp_sheet = L.expireIfDue(S.acc_s, LATE).offer;
    S.reopened_resp = go(S.exp_resp_s, 'REOPEN', 'S', { at: LATE + 1000 });
    S.exp_resp_used = L.expireIfDue(S.reopened_resp, LATE + 20 * DAY).offer;
    S.reopened_sheet = go(S.exp_sheet, 'REOPEN', 'B', { at: LATE + 1000 });
    S.exp_sheet_used = L.expireIfDue(S.reopened_sheet, LATE + 20 * DAY).offer;
    chk(t, S.dealt2.state === 'ACCEPTED' && S.dealt2.deal.confirm.S && !S.dealt2.deal.confirm.B === false, 'a sealed slip needs both confirmations'); // S.dealt2 = first confirm on a sealed slip finishes only when BOTH confirmed
    delete S.dealt2; // (the assertion above documents the rule; the state itself is covered by acc_sealed)
    S.none = null;

    const stateOf = o => o ? o.state : 'NONE';
    const expected = (o, cmd, late) => {
      const validBy = cmd.by === 'S' || cmd.by === 'B' || (cmd.by === 'SYS' && cmd.type === 'SEALED_DEAL');
      if (!validBy) return 'BAD_ACTOR';
      if (cmd.type === 'OFFER') return o ? 'ILLEGAL_STATE' : 'ok:' + (cmd.by === 'B' ? 'AWAIT_SELLER' : 'AWAIT_BUYER');
      if (!o) return 'NOT_FOUND';
      if (cmd.baseVer !== o.ver) return 'STALE_VERSION';
      const st = o.state, awaiting = st === 'AWAIT_SELLER' || st === 'AWAIT_BUYER';
      if (late && (awaiting || st === 'ACCEPTED') && cmd.type !== 'REOPEN') return 'EXPIRED';
      if (st === 'DEALT' || st === 'DECLINED') return 'ILLEGAL_STATE';
      if (st === 'EXPIRED' && cmd.type !== 'REOPEN') return 'EXPIRED';
      const awaited = st === 'AWAIT_SELLER' ? 'S' : st === 'AWAIT_BUYER' ? 'B' : null;
      switch (cmd.type) {
        case 'COUNTER': if (!awaiting) return 'ILLEGAL_STATE'; if (awaited !== cmd.by) return 'NOT_YOUR_TURN'; if (o.proposal.final) return 'FINAL_LOCKED'; return 'ok:' + (cmd.by === 'S' ? 'AWAIT_BUYER' : 'AWAIT_SELLER');
        case 'ACCEPT': if (!awaiting) return 'ILLEGAL_STATE'; return awaited !== cmd.by ? 'NOT_YOUR_TURN' : 'ok:ACCEPTED';
        case 'CONFIRM': if (st !== 'ACCEPTED') return 'ILLEGAL_STATE'; return o.deal.confirm[cmd.by] ? 'ALREADY_CONFIRMED' : 'ok:DEALT';
        case 'DECLINE': if (awaiting) return 'ok:DECLINED'; if (st === 'ACCEPTED') return o.deal.confirm[cmd.by] ? 'ILLEGAL_STATE' : 'ok:DECLINED'; return 'ILLEGAL_STATE';
        case 'REOPEN': if (st !== 'EXPIRED') return 'ILLEGAL_STATE'; if (o.reopens >= 1) return 'REOPEN_LIMIT'; return 'ok:' + (o.expiredReason === 'sheet' ? 'ACCEPTED' : o.prevState);
        case 'SEALED_DEAL': return awaiting ? 'ok:ACCEPTED' : 'ILLEGAL_STATE';
        default: return awaiting || st === 'ACCEPTED' ? 'UNKNOWN_ACTION' : 'ILLEGAL_STATE'; // unreachable states were handled above
      }
    };
    const LEGAL = { // (type, from) -> allowed `to` (independent of the implementation; from the spec table)
      OFFER: { NONE: ['AWAIT_SELLER', 'AWAIT_BUYER'] }, COUNTER: { AWAIT_SELLER: ['AWAIT_BUYER'], AWAIT_BUYER: ['AWAIT_SELLER'] },
      ACCEPT: { AWAIT_SELLER: ['ACCEPTED'], AWAIT_BUYER: ['ACCEPTED'] }, CONFIRM: { ACCEPTED: ['DEALT'] },
      DECLINE: { AWAIT_SELLER: ['DECLINED'], AWAIT_BUYER: ['DECLINED'], ACCEPTED: ['DECLINED'] },
      REOPEN: { EXPIRED: ['AWAIT_SELLER', 'AWAIT_BUYER', 'ACCEPTED'] }, SEALED_DEAL: { AWAIT_SELLER: ['ACCEPTED'], AWAIT_BUYER: ['ACCEPTED'] },
    };
    let combos = 0, oks = 0;
    for (const [sname, o] of Object.entries(S)) for (const type of ['OFFER', 'COUNTER', 'ACCEPT', 'CONFIRM', 'DECLINE', 'REOPEN', 'SEALED_DEAL', 'BOGUS']) for (const by of ['S', 'B', 'SYS', 'X']) for (const late of [false, true]) for (const stale of [false, true]) {
      const freshAt = o ? lastAt(o) + 1000 : T0, cmd = { type, by, at: late ? freshAt + 5 * DAY : freshAt, baseVer: o ? (stale ? o.ver - 1 : o.ver) : undefined };
      if (type === 'COUNTER') cmd.terms = o ? { ...o.proposal.terms, priceMinorPerKg: o.proposal.terms.priceMinorPerKg + C.step } : price(1);
      if (type === 'OFFER') cmd.terms = TE, cmd.meta = META;
      if (type === 'SEALED_DEAL') cmd.priceMinorPerKg = C.sealed;
      const before = J(o), tag = () => `[${cfgName}] ${sname} <- ${type}/${by} late=${late} stale=${stale}`;
      let res, threw = null; try { res = L.applyAction(o, clone(cmd), ctx); } catch (e) { threw = e; }
      chk(t, !threw, () => `${tag()} threw ${threw}`); if (threw) continue;
      combos++;
      chk(t, J(o) === before, () => `${tag()} mutated its input`);
      const got = res.ok ? 'ok:' + res.offer.state : res.error, want = expected(o, cmd, late);
      chk(t, got === want, () => `${tag()}: expected ${want}, got ${got}`);
      eqDeep(t, L.applyAction(o, clone(cmd), ctx), res, `${tag()} not deterministic`);
      if (!res.ok) {
        chk(t, ALL_CODES.has(res.error), () => `${tag()} unknown error code ${res.error}`);
        chk(t, res.offer === o && J(res.offer) === before, () => `${tag()} failure must hand back the untouched offer`);
        chk(t, Object.keys(res).sort().join() === 'error,offer,ok', () => `${tag()} failure shape ${Object.keys(res)}`);
      } else {
        oks++;
        const from = stateOf(o), to = res.offer.state, ver0 = o ? o.ver : 0;
        chk(t, (LEGAL[type][from] || []).includes(to), () => `${tag()} illegal transition ${from} -> ${to}`);
        chk(t, res.offer !== o && res.offer.ver === ver0 + 1 && res.offer.history.length === res.offer.ver, () => `${tag()} ver/history bookkeeping`);
        chk(t, res.event.type === type && res.event.from === (o ? o.state : null) && res.event.to === to && res.event.by === by, () => `${tag()} event ${J(res.event)}`);
        chk(t, Array.isArray(res.effects) && res.effects.every(e => EFFECT_TYPES.has(e.type)), () => `${tag()} effects ${J(res.effects)}`);
        const eff = res.effects.map(e => e.type).join();
        const wantEff = type === 'ACCEPT' || type === 'SEALED_DEAL' ? 'RESERVE_STOCK' : type === 'CONFIRM' ? 'RECORD_TRADE' : type === 'DECLINE' && from === 'ACCEPTED' ? 'RELEASE_STOCK' : type === 'REOPEN' && to === 'ACCEPTED' ? 'RESERVE_STOCK' : '';
        chk(t, eff === wantEff, () => `${tag()} effects [${eff}] want [${wantEff}]`);
        if (type === 'ACCEPT') chk(t, res.offer.deal.confirm[by] === true && res.offer.deal.confirm[by === 'S' ? 'B' : 'S'] === false && res.offer.deal.acceptedBy === by, () => `${tag()} acceptor auto-confirms only himself`);
        if (type === 'SEALED_DEAL') chk(t, !res.offer.deal.confirm.S && !res.offer.deal.confirm.B && res.offer.deal.acceptedBy === 'SYS' && res.offer.deal.terms.priceMinorPerKg === C.sealed, () => `${tag()} sealed slip starts unconfirmed`);
        if (type === 'CONFIRM') chk(t, res.offer.deal.confirm.S && res.offer.deal.confirm.B, () => `${tag()} DEALT needs both confirmations`);
        if (type === 'DECLINE') chk(t, res.offer.declineBy === by && (res.offer.gapBand === null || ['overlap', 'small', 'medium', 'large'].includes(res.offer.gapBand.level)), () => `${tag()} decline bookkeeping ${J(res.offer.gapBand)}`);
        if (type === 'COUNTER') chk(t, res.offer.turn === o.turn + 1 && res.offer.proposal.by === by && J(res.event.changed) === '["priceMinorPerKg"]' && res.offer.proposal.final === (res.offer.turn >= 5), () => `${tag()} counter bookkeeping`);
        if (type === 'REOPEN') chk(t, res.offer.reopens === o.reopens + 1 && res.offer.expiredReason === null, () => `${tag()} reopen bookkeeping`);
      }
    }
    chk(t, combos > 1500 && oks > 100, () => `[${cfgName}] combos=${combos} ok=${oks}`);
    // terminal states accept nothing at all
    for (const s of ['dealt', 'decl_aw', 'decl_wd', 'decl_acc']) for (const type of ['COUNTER', 'ACCEPT', 'CONFIRM', 'DECLINE', 'REOPEN', 'SEALED_DEAL'])
      for (const by of ['S', 'B']) chk(t, L.applyAction(S[s], { type, by, at: LATE, baseVer: S[s].ver, terms: price(1), priceMinorPerKg: C.sealed }, ctx).ok === false, () => `${s} accepted ${type}`);
    // per-rule spot checks with the exact codes
    const A = (o, cmd) => L.applyAction(o, { at: lastAt(o) + 1000, baseVer: o.ver, ...cmd }, ctx);
    eqDeep(t, [A(S.aw_b, { type: 'COUNTER', by: 'B', terms: price(1) }).error, A(S.aw_b, { type: 'ACCEPT', by: 'S' }).error], ['NOT_YOUR_TURN', 'NOT_YOUR_TURN'], 'only the awaited side may counter/accept');
    eqDeep(t, [A(S.aw_b, { type: 'COUNTER', by: 'S', terms: S.aw_b.proposal.terms }).error, A(S.aw_b, { type: 'COUNTER', by: 'S', terms: { ...S.aw_b.proposal.terms, priceMinorPerKg: 1 + S.aw_b.proposal.terms.priceMinorPerKg, grams: 21000, grade: 'A', delivery: 'deliver' } }).error], ['ILLEGAL_STATE', 'ILLEGAL_STATE'], 'S cannot move while it is B\'s turn (sanity)');
    eqDeep(t, [A(S.aw_s, { type: 'COUNTER', by: 'S', terms: S.aw_s.proposal.terms }).error, A(S.aw_s, { type: 'COUNTER', by: 'S', terms: { ...TE, priceMinorPerKg: TE.priceMinorPerKg + C.step, grams: 21000, delivery: 'deliver' } }).error, A(S.aw_s, { type: 'COUNTER', by: 'S', terms: { ...TE, priceMinorPerKg: TE.priceMinorPerKg + C.step, grams: 21000 } }).ok], ['NO_CHANGE', 'TOO_MANY_FIELDS', true], 'field-change limits (0 -> NO_CHANGE, 3 -> TOO_MANY, 2 ok)');
    eqDeep(t, [A(S.aw_s, { type: 'COUNTER', by: 'S', terms: price(1), final: true }).error, A(S.aw_s3, { type: 'COUNTER', by: 'S', terms: price(5), final: true }).ok, A(S.aw_s_final, { type: 'COUNTER', by: 'S', terms: price(5) }).error, A(S.aw_s5, { type: 'COUNTER', by: 'S', terms: price(5) }).error], ['FINAL_TOO_EARLY', true, 'FINAL_LOCKED', 'FINAL_LOCKED'], 'final flag rules (allowed from turn 3; turn 5 auto-final)');
    chk(t, S.aw_s5.turn === 5 && S.aw_s5.proposal.final === true && S.aw_s_final.proposal.final === true && S.aw_s3.proposal.final === false, 'turn 5 proposal is automatically final');
    eqDeep(t, [A(S.aw_s_final, { type: 'ACCEPT', by: 'S' }).ok, A(S.aw_s_final, { type: 'DECLINE', by: 'S' }).ok], [true, true], 'a final price can still be accepted or declined');
    eqDeep(t, [A(S.aw_b, { type: 'COUNTER', by: 'B', terms: { ...TE, grade: 'Z' } }).error], ['NOT_YOUR_TURN'], 'turn is checked before terms');
    eqDeep(t, ['BAD_GRADE', 'BAD_DELIVERY', 'BAD_PAYMENT', 'BAD_GRAMS', 'BAD_PRICE', 'BAD_TERMS'].map((c, i) => A(S.aw_s, { type: 'COUNTER', by: 'S', terms: [{ ...TE, grade: 'Z' }, { ...TE, delivery: 'x' }, { ...TE, payment: 'x' }, { ...TE, grams: 5 }, { ...TE, priceMinorPerKg: 0 }, null][i] }).error), ['BAD_GRADE', 'BAD_DELIVERY', 'BAD_PAYMENT', 'BAD_GRAMS', 'BAD_PRICE', 'BAD_TERMS'], 'terms validation codes');
    eqDeep(t, [A(S.aw_s, { type: 'COUNTER', by: 'S', terms: { ...TE, grams: 300000, priceMinorPerKg: TE.priceMinorPerKg + C.step } }).error], ['OVER_STOCK'], 'over stock on counter');
    const strictCtx = { ...ctx, listingGrade: 'B' }; eqDeep(t, [L.applyAction(null, { type: 'OFFER', by: 'B', at: T0, terms: TE, meta: META }, strictCtx).error, L.applyAction(null, { type: 'OFFER', by: 'B', at: T0, terms: { ...TE, grade: 'B' }, meta: META }, strictCtx).ok], ['GRADE_NOT_OFFERED', true], 'buyers cannot ask for a better grade than listed');
    eqDeep(t, [L.applyAction(null, { type: 'OFFER', by: 'B', at: T0, terms: { ...TE, grams: 300000 }, meta: META }, ctx).error, L.applyAction(null, { type: 'OFFER', by: 'B', at: T0, terms: TE, meta: META }, ctx).offer.state], ['OVER_STOCK', 'AWAIT_SELLER'], 'OFFER validates stock');
    eqDeep(t, [L.applyAction(null, { type: 'OFFER', by: 'B', at: T0, terms: { ...TE, grams: 0 } }, ctx).offer, L.applyAction(S.aw_s, { type: 'OFFER', by: 'S', at: T0, terms: TE }, ctx).error], [null, 'ILLEGAL_STATE'], 'failed OFFER hands back null');
    // stock and time
    const tight = { ...ctx, remainingGrams: TE.grams - 1 }; eqDeep(t, L.applyAction(S.aw_s, { type: 'ACCEPT', by: 'S', at: T0 + 1, baseVer: 1 }, tight).error, 'OVER_STOCK', 'ACCEPT re-checks remaining stock');
    const dueAt = S.aw_s.proposal.respondBy; chk(t, L.isDue(S.aw_s, dueAt) === false && L.isDue(S.aw_s, dueAt + 1) === true && L.expireIfDue(S.aw_s, dueAt).changed === false && L.expireIfDue(S.aw_s, dueAt + 1).changed === true, 'respondBy boundary: exactly equal is not due');
    const dl = S.acc_s.deal.deadline; chk(t, L.isDue(S.acc_s, dl) === false && L.isDue(S.acc_s, dl + 1) === true && dl === S.acc_s.deal.issuedAt + 24 * HOUR && !L.isDue(S.dealt, LATE) && !L.isDue(S.exp_resp_s, LATE), 'sheet deadline is +24h; terminal/expired never due');
    const e1 = L.expireIfDue(S.acc_s, LATE), e2 = L.expireIfDue(e1.offer, LATE * 2);
    chk(t, e1.changed && e1.offer.state === 'EXPIRED' && e1.offer.expiredReason === 'sheet' && e1.offer.prevState === 'ACCEPTED' && J(e1.effects) === J([{ type: 'RELEASE_STOCK', grams: TE.grams }]) && e2.changed === false && e2.offer === e1.offer, 'expireIfDue is idempotent and releases stock exactly once');
    chk(t, L.expireIfDue(S.aw_s, LATE).effects.length === 0 && L.expireIfDue(S.aw_s, LATE).offer.expiredReason === 'respond' && L.expireIfDue(S.aw_s, LATE).offer.prevState === 'AWAIT_SELLER', 'expiring an unanswered proposal releases nothing');
    chk(t, S.reopened_resp.state === 'AWAIT_SELLER' && S.reopened_resp.proposal.respondBy === LATE + 1000 + ctx.respondMs && S.reopened_sheet.state === 'ACCEPTED' && S.reopened_sheet.deal.deadline === LATE + 1000 + 24 * HOUR && S.reopened_sheet.deal.confirm.S === true, 'REOPEN restores the previous state with fresh deadlines');
    eqDeep(t, [A(S.exp_resp_used, { type: 'REOPEN', by: 'S', at: LATE * 3 }).error, A(S.exp_sheet_used, { type: 'REOPEN', by: 'S', at: LATE * 3 }).error], ['REOPEN_LIMIT', 'REOPEN_LIMIT'], 'a single reopen per offer');
    eqDeep(t, [L.applyAction(S.exp_sheet, { type: 'REOPEN', by: 'S', at: LATE + 1, baseVer: S.exp_sheet.ver }, { ...ctx, listingOpen: false }).error, L.applyAction(S.exp_sheet, { type: 'REOPEN', by: 'S', at: LATE + 1, baseVer: S.exp_sheet.ver }, { ...ctx, remainingGrams: 5 }).error], ['LISTING_CLOSED', 'OVER_STOCK'], 'reopen guards');
    // read-back rule: needs a big slip (>= readbackMinMajor)
    const bigT = C.pack === 'ng-kano' ? { grams: 126000, priceMinorPerKg: 455, grade: 'A', delivery: 'pickup', payment: 'cash' } : { grams: 500000, priceMinorPerKg: 1800, grade: 'A', delivery: 'pickup', payment: 'cash' };
    const sheet = L.dealSheet(C.pack, bigT, ctx.sheetCtx); chk(t, sheet.readbackRequired, 'the big slip requires a read-back');
    const bigO = L.applyAction(null, { type: 'OFFER', by: 'B', at: T0, terms: bigT, meta: META }, ctx).offer, wrong = sheet.lastTwo === '99' ? '98' : '99';
    eqDeep(t, [A(bigO, { type: 'ACCEPT', by: 'S' }).error, A(bigO, { type: 'ACCEPT', by: 'S', last2: wrong }).error, A(bigO, { type: 'ACCEPT', by: 'S', last2: sheet.lastTwo }).ok, A(bigO, { type: 'ACCEPT', by: 'S', last2: Number(sheet.lastTwo) }).ok === (String(Number(sheet.lastTwo)) === sheet.lastTwo)], ['READBACK_REQUIRED', 'READBACK_MISMATCH', true, true], 'read-back on ACCEPT');
    const bigAcc = A(bigO, { type: 'ACCEPT', by: 'S', last2: sheet.lastTwo }).offer;
    eqDeep(t, [A(bigAcc, { type: 'CONFIRM', by: 'B' }).error, A(bigAcc, { type: 'CONFIRM', by: 'B', last2: wrong }).error, A(bigAcc, { type: 'CONFIRM', by: 'B', last2: sheet.lastTwo }).offer.state, A(bigAcc, { type: 'CONFIRM', by: 'S', last2: sheet.lastTwo }).error], ['READBACK_REQUIRED', 'READBACK_MISMATCH', 'DEALT', 'ALREADY_CONFIRMED'], 'read-back on CONFIRM');
    // the deal sheet frozen at ACCEPT is the same one dealSheet gives and it is what RECORD_TRADE carries
    chk(t, J(bigAcc.deal.sheet) === J(sheet) && J(bigAcc.deal.terms) === J(bigT), 'accepted slip == dealSheet(terms)');
    const rec = A(bigAcc, { type: 'CONFIRM', by: 'B', last2: sheet.lastTwo }).effects[0]; chk(t, rec.type === 'RECORD_TRADE' && J(rec.sheet) === J(sheet) && J(rec.terms) === J(bigT), 'RECORD_TRADE carries the slip');
    // gapBand on DECLINE follows lastPrices
    const gb = A(S.aw_b, { type: 'DECLINE', by: 'B' }).offer.gapBand, lp = L.lastPrices(S.aw_b);
    eqDeep(t, [lp, gb], [{ S: price(6).priceMinorPerKg, B: TE.priceMinorPerKg }, L.gapBand(C.pack, price(6).priceMinorPerKg, TE.priceMinorPerKg)], 'DECLINE stores gapBand(lastPrices)');
    eqDeep(t, [S.decl_aw.gapBand.level, L.applyAction(null, { type: 'OFFER', by: 'S', at: T0, terms: TE, meta: META }, ctx).offer.state], [L.gapBand(C.pack, TE.priceMinorPerKg + 30, TE.priceMinorPerKg).level, 'AWAIT_BUYER'], 'seller-only offers fall back to the listing ask for the gap');
    // applySequence == chaining applyAction
    const seq = L.applySequence(null, [{ type: 'OFFER', by: 'B', at: T0, terms: TE, meta: META }, { type: 'COUNTER', by: 'S', at: T0 + 1, terms: price(6) }, { type: 'COUNTER', by: 'S', at: T0 + 2, terms: price(7) }, { type: 'ACCEPT', by: 'B', at: T0 + 3 }, { type: 'CONFIRM', by: 'S', at: T0 + 4 }], ctx);
    eqDeep(t, seq.steps.map(x => x.ok ? x.state : x.error), ['AWAIT_SELLER', 'AWAIT_BUYER', 'NOT_YOUR_TURN', 'ACCEPTED', 'DEALT'], 'applySequence steps (failed step leaves the offer alone)');
    eqDeep(t, seq.final, { state: 'DEALT', turn: 2, ver: 4, price: price(6).priceMinorPerKg, gapBand: null, reopens: 0 }, 'applySequence final summary');
    eqDeep(t, L.applySequence(null, [{ type: 'ACCEPT', by: 'S', at: T0 }], ctx), { steps: [{ ok: false, type: 'ACCEPT', by: 'S', error: 'NOT_FOUND', state: null }], final: null }, 'applySequence on nothing');
  }

  // ---- seeded random walks: invariants must hold after every step, whatever the commands
  const walkCfg = [CONFIGS['ng-kano'], CONFIGS['in-bihar']];
  let steps = 0, reached = new Set(), dealtN = 0;
  for (let w = 0; w < 400; w++) {
    const r = mkRng(1100 + w), C = walkCfg[w % 2], ctx = ctxOf(C), big = w % 3 === 0;
    const bigT = C.pack === 'ng-kano' ? { grams: 126000, priceMinorPerKg: 455, grade: 'A', delivery: 'pickup', payment: 'cash' } : { grams: 500000, priceMinorPerKg: 1800, grade: 'A', delivery: 'pickup', payment: 'cash' };
    const baseT = big ? bigT : C.terms;
    let o = null, now = T0, reserved = 0, trades = 0, prevTurn = 0, over = false;
    const apply = res => {
      for (const e of res.effects || []) { if (e.type === 'RESERVE_STOCK') reserved += e.grams; else if (e.type === 'RELEASE_STOCK') reserved -= e.grams; else if (e.type === 'RECORD_TRADE') { reserved -= res.offer.deal.terms.grams; trades++; } }
    };
    for (let k = 0; k < 40 && !over; k++) {
      now += r.pick([1000, 60000, HOUR, 3 * HOUR, 30 * HOUR, 5 * DAY, 60000]);
      if (o && r.f() < 0.12) { // server tick
        const ex = L.expireIfDue(o, now);
        if (ex.changed) { chk(t, ex.offer.state === 'EXPIRED' && ex.offer.ver === o.ver + 1 && ex.offer.history.length === ex.offer.ver && ex.offer.history[ex.offer.history.length - 1].by === 'SYS', 'tick bookkeeping'); apply(ex); o = ex.offer; }
        else chk(t, ex.offer === o && ex.effects.length === 0, 'unchanged tick returns the same offer');
        chk(t, reserved === (o.state === 'ACCEPTED' ? o.deal.terms.grams : 0), () => `walk ${w}: stock ledger after tick ${reserved} vs ${o.state}`);
        continue;
      }
      const type = r.pick(o ? ['COUNTER', 'COUNTER', 'ACCEPT', 'ACCEPT', 'CONFIRM', 'DECLINE', 'REOPEN', 'OFFER', 'BOGUS', 'SEALED_DEAL'] : ['OFFER', 'OFFER', 'COUNTER', 'ACCEPT']);
      const by = r.f() < 0.03 ? r.pick(['X', 'SYS', undefined]) : r.pick(['S', 'B']);
      const cmd = { type, by, at: now, baseVer: o ? (r.f() < 0.07 ? o.ver + r.pick([-1, 1]) : o.ver) : undefined, phraseId: r.pick([null, 'P01', 'P09']) };
      const cur = o ? o.proposal.terms : baseT, variant = r.int(0, 9);
      cmd.terms = variant < 5 ? { ...cur, priceMinorPerKg: Math.max(1, cur.priceMinorPerKg + r.pick([-2, -1, 1, 2, 3]) * C.step) } : variant === 5 ? { ...cur } : variant === 6 ? { ...cur, priceMinorPerKg: cur.priceMinorPerKg + C.step, grams: cur.grams + 1000 } : variant === 7 ? { ...cur, priceMinorPerKg: cur.priceMinorPerKg + C.step, grams: cur.grams + 1000, delivery: cur.delivery === 'pickup' ? 'deliver' : 'pickup' } : variant === 8 ? { ...cur, grade: r.pick(['A', 'B', 'Z']) } : { ...cur, grams: r.pick([500, 300000, cur.grams]) };
      if (type === 'OFFER') { cmd.terms = { ...baseT, priceMinorPerKg: baseT.priceMinorPerKg + r.int(-3, 3) * C.step }; cmd.meta = META; }
      cmd.final = r.f() < 0.15; cmd.priceMinorPerKg = r.f() < 0.8 ? C.sealed + r.int(-2, 2) * C.step : -5;
      cmd.last2 = r.pick([undefined, L.dealSheet(C.pack, big ? bigT : baseT, ctx.sheetCtx).lastTwo, '00', 7]);
      const before = J(o), res = L.applyAction(o, clone(cmd), ctx); steps++;
      chk(t, J(o) === before, () => `walk ${w}: input mutated by ${type}`);
      if (!res.ok) { chk(t, ALL_CODES.has(res.error) && J(res.offer) === before, () => `walk ${w}: ${type}/${by} failed with ${res.error} but offer changed or code unknown`); continue; }
      const prev = o; o = res.offer; apply(res); reached.add(o.state);
      chk(t, prev ? o.ver === prev.ver + 1 : o.ver === 1, () => `walk ${w}: ver`);
      chk(t, o.history.length === o.ver && o.turn >= prevTurn && o.turn <= 5 && (type === 'COUNTER' ? o.turn === prevTurn + 1 : o.turn === Math.max(1, prevTurn)), () => `walk ${w}: turn/history after ${type}: turn ${o.turn} prev ${prevTurn}`);
      prevTurn = o.turn;
      chk(t, o.turn < 5 || o.proposal.final, () => `walk ${w}: fifth proposal must be final`);
      chk(t, reserved === (o.state === 'ACCEPTED' ? o.deal.terms.grams : 0), () => `walk ${w}: stock ledger ${reserved} in ${o.state}`);
      chk(t, o.state !== 'DEALT' || (o.deal.confirm.S && o.deal.confirm.B && trades === 1), () => `walk ${w}: DEALT needs both confirms and exactly one trade record`);
      chk(t, ['AWAIT_SELLER', 'AWAIT_BUYER', 'ACCEPTED', 'DEALT', 'DECLINED', 'EXPIRED'].includes(o.state), () => `walk ${w}: unknown state ${o.state}`);
      chk(t, o.history.every((h, i) => i === 0 || (h.ver === o.history[i - 1].ver + 1)) && o.history[o.history.length - 1].ver === o.ver, () => `walk ${w}: history versions contiguous`);
      chk(t, o.proposal.terms.priceMinorPerKg >= 1 && o.proposal.terms.grams >= 1000, () => `walk ${w}: proposal terms valid`);
      if (o.state === 'DEALT') dealtN++;
      if (o.state === 'DEALT' || o.state === 'DECLINED') over = true;
    }
    if (o && o.state === 'DEALT') { chk(t, L.applyAction(o, { type: 'DECLINE', by: 'S', at: now + 1, baseVer: o.ver }, ctx).ok === false, 'a finished deal stays finished'); }
  }
  chk(t, steps > 8000 && dealtN > 20 && ['AWAIT_SELLER', 'AWAIT_BUYER', 'ACCEPTED', 'DEALT', 'DECLINED', 'EXPIRED'].every(s => reached.has(s)), () => `random walks must reach every state (steps ${steps}, dealt ${dealtN}, states ${[...reached]})`);
  // pure helpers
  eqDeep(t, [L.changedFields({ grams: 1, priceMinorPerKg: 2, grade: 'A', delivery: 'pickup', payment: 'cash' }, { grams: 1, priceMinorPerKg: 3, grade: 'B', delivery: 'pickup', payment: 'cash' }), L.CONST.TERM_FIELDS], [['priceMinorPerKg', 'grade'], ['grams', 'priceMinorPerKg', 'grade', 'delivery', 'payment']], 'changedFields / TERM_FIELDS');
  for (let s = 400; s <= 500; s += 5) for (let b = 0; b <= s + 30; b += 7) { const g = L.gapBand('ng-kano', s, b); chk(t, g.ok && (b >= s ? g.level === 'overlap' && g.gapBps === 0 : g.gapBps === bdiv((s - b) * 10000, s) && g.level === (g.gapBps < 500 ? 'small' : g.gapBps < 1500 ? 'medium' : 'large')), () => `gapBand ${s},${b}: ${J(g)}`); }
  let pv = -1; const order = ['overlap', 'small', 'medium', 'large']; for (let b = 600; b >= 0; b--) { const g = L.gapBand('ng-kano', 600, b), k = order.indexOf(g.level); chk(t, k >= pv, () => `gapBand level not monotone at buyer ${b}`); pv = k; }
  t.done();
}

// ================================================================ 12. coach, matching, sealed, weighing, misc
{
  const t = suite('props: coach, matching, sealed bargaining, weighing, reputation'); const r = mkRng(12);
  for (const pid of PACKS) {
    const p = P(pid), step = p.currency.priceStep, N = p.negotiation;
    // ---- suggestCounter
    for (let i = 0; i < 3000; i++) {
      const role = r.pick(['S', 'B']), myLast = r.int(60, 3000) * step, gap = r.int(0, 800) * step / 5 | 0, their = role === 'S' ? myLast - gap : myLast + gap, hasLimit = r.f() < 0.8;
      const limit = hasLimit ? (role === 'S' ? myLast - r.int(0, Math.max(1, Math.floor(myLast / step))) * step : myLast + r.int(0, 300) * step) : null;
      const o = { role, myLast, theirLast: Math.max(1, their), limit: limit != null ? Math.max(1, limit) : null, target: r.f() < 0.5 ? (role === 'S' ? myLast : myLast) : null, turn: r.int(1, 4), maxTurns: 5, concessions: r.int(0, 6) };
      const s = L.suggestCounter(pid, o), tag = () => `${pid} ${J(o)} -> ${J(s)}`;
      chk(t, s.ok && ['accept', 'counter', 'decline'].includes(s.advice) && typeof s.markFinal === 'boolean', () => `shape ${tag()}`);
      if (s.advice === 'accept') chk(t, s.priceMinorPerKg === o.theirLast, () => `accept price ${tag()}`);
      if (s.advice === 'decline') chk(t, s.priceMinorPerKg === null && o.turn + 1 >= o.maxTurns && (role === 'S' ? o.theirLast < o.limit : o.theirLast > o.limit), () => `decline only at the last turn and beyond the limit ${tag()}`);
      if (s.advice === 'counter') {
        chk(t, isInt(s.priceMinorPerKg) && s.priceMinorPerKg > 0, () => `counter price int ${tag()}`);
        chk(t, role === 'S' ? o.theirLast < s.priceMinorPerKg && s.priceMinorPerKg <= o.myLast : o.myLast <= s.priceMinorPerKg && s.priceMinorPerKg < o.theirLast, () => `counter lies between the two prices ${tag()}`);
        if (o.limit != null) chk(t, role === 'S' ? s.priceMinorPerKg >= o.limit : s.priceMinorPerKg <= o.limit, () => `counter respects the private limit ${tag()}`);
        chk(t, s.priceMinorPerKg % step === 0 || s.reason === 'AT_LIMIT', () => `counter on the price step ${tag()}`);
        chk(t, s.concedeMinor === Math.abs(o.myLast - s.priceMinorPerKg) && ['SPLIT', 'AT_LIMIT'].includes(s.reason) && (s.markFinal === false || (s.reason === 'AT_LIMIT' && o.turn + 1 >= N.finalFromTurn)), () => `concession bookkeeping ${tag()}`);
        chk(t, o.turn + 1 < o.maxTurns, () => `no counter suggested at the last chance ${tag()}`);
      }
      if (o.theirLast >= o.myLast === (role === 'S')) chk(t, s.advice === 'accept' || o.theirLast === o.myLast, () => `a better-than-mine offer is accepted ${tag()}`);
    }
    // ---- limits & ladder & verdict from a real band
    for (let i = 0; i < 1500; i++) {
      const mid = r.int(100, 5000), low = mid - r.int(1, Math.floor(mid / 10)), high = mid + r.int(1, Math.floor(mid / 10)), ref = { ok: true, state: 'deals', mid, low, high, gradeBasis: 'A' }, grade = r.pick(p.grades), role = r.pick(['S', 'B']);
      const adj = { low: L.gradeAdjust(pid, low, grade), mid: L.gradeAdjust(pid, mid, grade), high: L.gradeAdjust(pid, high, grade) };
      const exit = r.f() < 0.7 ? r.int(1, mid * 2) : null, dl = L.defaultLimits(pid, { role, ref, exitMinor: exit, grade }), tag = () => `${pid} ${role} ${grade} ${J(ref)} exit=${exit} -> ${J(dl)}`;
      chk(t, dl.ok && isInt(dl.limit) && isInt(dl.target) && dl.limit % step === 0 && dl.target % step === 0, () => `defaultLimits ints on step ${tag()}`);
      if (role === 'S') chk(t, dl.limit >= adj.low && (exit == null || dl.limit >= exit) && dl.target >= adj.mid, () => `seller floor not below band/exit ${tag()}`); else chk(t, dl.limit <= adj.high && (exit == null || dl.limit <= exit) && dl.target <= adj.mid, () => `buyer cap not above band/exit ${tag()}`);
      const lad = L.openingLadder(pid, { role, ref: adj, limit: dl.limit }).rungs;
      chk(t, lad.length >= 1 && lad.length <= 3 && new Set(lad).size === lad.length && lad.every(x => isInt(x) && x % step === 0), () => `ladder ${role} ${J(lad)}`);
      chk(t, role === 'B' ? sorted(lad, (a, b) => a - b) && lad.every(x => x <= dl.limit) : sorted(lad, (a, b) => b - a) && lad.every(x => x >= dl.limit), () => `ladder ordering/limit ${role} ${J(lad)} limit ${dl.limit}`);
      const x = r.int(1, mid * 2), q = L.quoteVerdict(pid, { role, priceMinorPerKg: x, ref, grade }), pos = x < adj.low ? 'below' : x > adj.high ? 'above' : 'inside';
      chk(t, q.ok && q.position === pos && q.low === adj.low && q.high === adj.high && q.mid === adj.mid && Math.sign(q.vsMidBps) === Math.sign(x - adj.mid) && (pos === 'inside' ? q.outsideBps === 0 && q.signal === 'fair' : q.outsideBps > 0), () => `quoteVerdict ${x} ${J(q)}`);
      chk(t, pos === 'inside' || q.signal === (role === 'S' ? (pos === 'below' ? 'caution' : 'good') : (pos === 'above' ? 'caution' : 'good')), () => `signal follows role ${role} ${pos} -> ${q.signal}`);
    }
    eqDeep(t, [L.defaultLimits(pid, { role: 'S', ref: null }), L.openingLadder(pid, { role: 'B', ref: null }), L.quoteVerdict(pid, { role: 'S', priceMinorPerKg: 5, ref: { mid: null } })], [{ ok: true, limit: null, target: null }, { ok: true, rungs: [] }, { ok: true, position: 'na', signal: 'na' }], `${pid} coach without a band degrades quietly`);
    // ---- magnitude & unit slip
    for (let i = 0; i < 2000; i++) {
      const mid = r.logInt(50, 20000), x = r.logInt(1, 200000), g = L.magnitudeGuard(pid, x, mid), f = N.magnitudeFactor;
      chk(t, g.level === (x >= mid * f ? 'high' : x * f <= mid ? 'low' : 'ok') && g.ratioBps === bdiv(BigInt(x) * 10000n, mid), () => `magnitudeGuard ${x} vs ${mid}: ${J(g)}`);
    }
    chk(t, ['x', null, NaN, 0, -3].every(v => L.magnitudeGuard(pid, 100, v).level === 'na') && L.magnitudeGuard(pid, 1.5, 100).level === 'na', `${pid} magnitudeGuard na cases`);
    for (const crop of p.crops) for (const m of p.markets) {
      const e = L.externalPrice(pid, crop.id, m.id, T0).priceMinorPerKg;
      chk(t, L.detectUnitSlip(pid, { cropId: crop.id, marketId: m.id, typedMinor: e, refMid: e }).suspect === null, () => `a correct per-kg price is never a slip ${pid} ${crop.id}@${m.id}`);
      for (const cid of crop.containers.filter(c => c !== 'kg')) {
        const gpc = L.containerGrams(pid, cid, { cropId: crop.id, marketId: m.id }).grams, typed = L.perContainerFromPerKg(e, gpc).pricePerContainerMinor, s = L.detectUnitSlip(pid, { cropId: crop.id, marketId: m.id, typedMinor: typed, refMid: e }).suspect;
        if (typed >= 2 * e) chk(t, s && s.impliedPerKgMinor >= e - Math.ceil(1000 / gpc) - 1 && s.impliedPerKgMinor <= e + Math.ceil(1000 / gpc) + 1, () => `unit slip ${pid} ${crop.id}/${cid}: typed ${typed} for ref ${e} -> ${J(s)}`);
      }
    }
    // ---- external exit prices
    for (const crop of p.crops.slice(0, 4)) for (const om of p.markets) for (const bm of p.markets) {
      const mids = {}; p.markets.forEach(m => { mids[m.id] = L.externalPrice(pid, crop.id, m.id, T0).priceMinorPerKg; });
      const es = L.exitPriceSeller(pid, { cropId: crop.id, originMarketId: om.id, grade: 'A', refMidByMarket: mids }), eb = L.exitPriceBuyer(pid, { cropId: crop.id, originMarketId: om.id, buyerMarketId: bm.id, grade: 'A', refMidByMarket: mids });
      chk(t, es.ok && es.alternatives.length === p.markets.length - 1 && es.priceMinorPerKg === es.alternatives[0].netMinorPerKg && es.viaMarketId === es.alternatives[0].marketId && sorted(es.alternatives, (a, b) => b.netMinorPerKg - a.netMinorPerKg) && es.alternatives.every(a => isInt(a.netMinorPerKg) && a.marketId !== om.id), () => `exitPriceSeller ${pid} ${crop.id} ${om.id}`);
      chk(t, eb.ok && eb.alternatives.length === p.markets.length - 1 && sorted(eb.alternatives, (a, b) => a.landedPerKgMinor - b.landedPerKgMinor) && isInt(eb.priceMinorPerKg) && eb.viaMarketId === eb.alternatives[0].marketId, () => `exitPriceBuyer ${pid} ${crop.id} ${om.id}->${bm.id}`);
    }
    // ---- matching
    const refsBy = {}; p.crops.forEach(c => { refsBy[c.id] = L.referencePrice(pid, { cropId: c.id, marketId: p.markets[0].id, now: T0, trades: [], external: L.externalPrice(pid, c.id, p.markets[0].id, T0) }); });
    for (let i = 0; i < 400; i++) {
      const buyer = { marketId: r.pick(p.markets).id, payment: r.pick([undefined, ...p.payments.map(x => x.id)]) };
      const ls = Array.from({ length: r.int(0, 8) }, (_, k) => { const c = r.pick(p.crops); return { id: 'L' + k, cropId: c.id, marketId: r.pick(p.markets).id, askMinorPerKg: r.int(50, 5000), grade: r.pick(p.grades), remainingGrams: r.pick([r.logInt(500, 1e6), 999, 1000]), confirmedAt: T0 - r.int(0, 5) * HOUR }; });
      const rows = L.rankListings(pid, buyer, ls, refsBy), rows2 = L.rankListings(pid, buyer, r.shuffle(ls), refsBy);
      eqDeep(t, rows2, rows, 'rankListings is independent of input order');
      chk(t, rows.length <= ls.length && new Set(rows.map(x => x.listingId)).size === rows.length, 'rankListings unique rows');
      chk(t, sorted(rows, (a, b) => (a.marginPerKgMinor == null) - (b.marginPerKgMinor == null) || (a.marginPerKgMinor != null ? b.marginPerKgMinor - a.marginPerKgMinor : 0) || b.confirmedAt - a.confirmedAt), () => `rankListings order ${J(rows.map(x => [x.listingId, x.marginPerKgMinor]))}`);
      for (const x of rows) chk(t, isInt(x.grams) && x.grams >= p.minGrams && isInt(x.landedPerKgMinor) && x.landedPerKgMinor >= 0 && (x.marginPerKgMinor === null || isInt(x.marginPerKgMinor)) && x.marginPerKgMinor === (x.anchorPerKgMinor == null ? null : x.anchorPerKgMinor - x.landedPerKgMinor), () => `rankListings row ${J(x)}`);
      chk(t, ls.filter(x => x.remainingGrams < p.minGrams).every(x => !rows.some(y => y.listingId === x.id)), 'rankListings drops lots under the 1 kg minimum');
      const seller = { marketId: r.pick(p.markets).id, stockGrams: r.pick([undefined, r.logInt(1000, 1e6)]) };
      const ws = Array.from({ length: r.int(0, 8) }, (_, k) => { const c = r.pick(p.crops); return { id: 'W' + k, cropId: c.id, marketId: r.pick(p.markets).id, remainingGrams: r.logInt(1000, 1e6), bidMinorPerKg: r.int(50, 5000), minGrade: r.pick(p.grades), delivery: r.pick(p.deliveries), payment: r.pick(p.payments).id, createdAt: T0 - r.int(0, 50) * 60000 }; });
      const wr = L.rankWants(pid, seller, ws, refsBy), wr2 = L.rankWants(pid, seller, r.shuffle(ws), refsBy);
      eqDeep(t, wr2, wr, 'rankWants is independent of input order');
      chk(t, sorted(wr, (a, b) => b.pocketPerKgMinor - a.pocketPerKgMinor || a.createdAt - b.createdAt) && wr.every(x => isInt(x.pocketPerKgMinor) && isInt(x.totalMinor) && x.totalMinor >= 0 && (x.belowBandBps === null || x.belowBandBps > 0)), () => `rankWants order/shape ${J(wr)}`);
    }
    // ---- visibility over time
    for (let i = 0; i < 400; i++) {
      const created = T0 + r.int(0, 5) * HOUR, exp = created + r.int(1, 10) * HOUR, trustedOnly = r.f() < 0.4, aud = r.pick(['public', 'trusted']), inCircle = r.f() < 0.4, L0 = { status: 'open', audience: aud, createdAt: created, expiresAt: exp, trustedOnly };
      const seen = []; for (let now = created - HOUR; now <= exp + HOUR; now += 5 * 60000) seen.push(L.visibleTo(pid, L0, 'u', inCircle ? ['u'] : [], now));
      const flips = seen.filter((v, k) => k > 0 && v !== seen[k - 1]).length;
      chk(t, flips <= 2, () => `visibility flaps ${J(L0)} circle=${inCircle}`);
      const at = now => L.visibleTo(pid, L0, 'u', inCircle ? ['u'] : [], now);
      chk(t, at(exp) === false && at(exp + 1) === false && (aud === 'public' || inCircle ? at(created) && at(exp - 1) : at(exp - 1) === !trustedOnly && (trustedOnly ? !at(exp - 1) : at(created + N.trustedWindowMin * 60000) && !at(created + N.trustedWindowMin * 60000 - 1) || exp <= created + N.trustedWindowMin * 60000)), () => `visibleTo rules ${J(L0)} circle=${inCircle}`);
      chk(t, !L.visibleTo(pid, { ...L0, status: 'sold', audience: 'public' }, 'u', [], created) && !L.visibleTo(pid, { ...L0, status: 'withdrawn' }, 'u', ['u'], created), 'closed listings are never visible');
    }
    // ---- sealed bargaining
    for (let i = 0; i < 2500; i++) {
      const floor = r.int(50, 5000), ceiling = r.int(50, 5000), round = r.int(1, 3), b = L.blindResolve(pid, { floor, ceiling, round }), tag = () => `${pid} ${floor}/${ceiling} r${round}: ${J(b)}`;
      chk(t, b.ok && b.deal === (ceiling >= floor), () => `blindResolve deal iff overlap ${tag()}`);
      if (b.deal) chk(t, b.priceMinorPerKg >= floor && b.priceMinorPerKg <= ceiling && (b.priceMinorPerKg % step === 0 || b.priceMinorPerKg === floor || b.priceMinorPerKg === ceiling) && b.midRaw === bdiv(floor + ceiling, 2), () => `sealed price in [floor,ceiling] on the step ${tag()}`);
      else { const g = L.gapBand(pid, floor, ceiling); chk(t, b.gapBps === g.gapBps && b.level === g.level && b.canReseal === (g.level === 'small' && round < N.blind.maxRounds), () => `sealed gap ${tag()}`); }
      const prev = r.int(50, 5000), rs = L.resealBounds(pid, { role: 'S', prev }), rb = L.resealBounds(pid, { role: 'B', prev });
      chk(t, rs.max === prev && rs.min <= prev && rs.min >= prev * 0.95 - 1e-9 && rs.min >= Math.ceil(prev * 0.95) - 0 && rb.min === prev && rb.max >= prev && rb.max <= Math.floor(prev * 1.05 + 1e-9), () => `resealBounds ${prev}: ${J([rs, rb])}`);
      const sg = L.sealedGuard(pid, floor, ceiling); chk(t, sg.far === (Math.abs(floor - ceiling) * 10000 / ceiling > N.blind.farFromBandBps + 0.5 || sg.deviationBps > N.blind.farFromBandBps) && sg.deviationBps === bdiv(Math.abs(floor - ceiling) * 10000, ceiling), () => `sealedGuard ${floor}/${ceiling}`);
    }
    // ---- weighing
    for (let i = 0; i < 2500; i++) {
      const a = r.logInt(1000, 5e6), b = r.f() < 0.5 ? a + r.int(-a / 10, a / 10 | 0) : r.logInt(1000, 5e6), pr = r.int(1, 3000), w = L.weighCompare(pid, { a, b, priceMinorPerKg: pr }), w2 = L.weighCompare(pid, { a: b, b: a, priceMinorPerKg: pr });
      const tag = () => `${a}/${b}: ${J(w)}`;
      eqDeep(t, w2, w, 'weighCompare is symmetric'); if (b < 1) continue;
      chk(t, w.ok && w.diffGrams === Math.abs(a - b) && w.level === (w.diffBps <= 100 ? 'green' : w.diffBps <= 300 ? 'yellow' : 'red') && (w.level === 'red' ? w.agreedGrams === null : w.agreedGrams >= Math.min(a, b) && w.agreedGrams <= Math.max(a, b)) && w.diffMinor === bdiv(w.diffGrams * pr, 1000), () => `weighCompare ${tag()}`);
    }
    // ---- reputation
    for (let i = 0; i < 800; i++) {
      const deals = r.int(0, 60), wc = r.int(0, deals), s = { deals, weighChecks: wc, weighOk: r.int(0, wc), onTime: r.int(0, deals), ghosts: r.int(0, deals) }, v = L.reputationView(pid, s);
      if (deals < N.reputationMinN) chk(t, J(v) === J({ kind: 'new', n: deals }), () => `reputation new ${J(v)}`);
      else { chk(t, v.kind === 'ok' && v.n === deals && v.dots.map(d => d.key).join() === 'weigh,time,kept' && v.dots.every(d => d.pct === null ? d.level === 'na' : d.pct >= 0 && d.pct <= 100 && d.level === (d.pct >= 90 ? 'full' : d.pct >= 70 ? 'half' : 'empty')) && (wc === 0) === (v.dots[0].pct === null), () => `reputation ${J(s)} -> ${J(v)}`); }
    }
    eqDeep(t, [L.reputationView(pid, null), L.reputationView(pid, undefined)], [{ kind: 'new', n: 0 }, { kind: 'new', n: 0 }], 'reputation without data');
    // ---- sms knocks
    for (let i = 0; i < 500; i++) {
      const now = T0 + DAY, times = Array.from({ length: r.int(0, 5) }, () => now - r.int(0, 2 * DAY)), recent = times.filter(x => now - x < DAY).length, ver = r.int(1, 4), k = L.knockAllowed(pid, { times, now, lastKnockVer: r.pick([null, ver, ver - 1]), offerVer: ver }), tag = () => `${J(times)} ver ${ver}: ${J(k)}`;
      if (k.ok) chk(t, recent < N.smsPerThreadPerDay && k.remaining === N.smsPerThreadPerDay - recent - 1 && k.remaining >= 0, () => `knock ok ${tag()}`); else chk(t, ['SAME_STATE', 'DAILY_LIMIT'].includes(k.reason) && !('error' in k), () => `knock refused ${tag()}`);
    }
  }
  // ---- makePrng: deterministic, uniform-ish, independent seeds
  const a = L.makePrng(42), b = L.makePrng(42), c = L.makePrng(43); let sum = 0, same = 0; const buckets = new Array(10).fill(0);
  for (let i = 0; i < 20000; i++) { const x = a(), y = b(), z = c(); chk(t, x === y && x >= 0 && x < 1, 'prng in [0,1) and reproducible'); sum += x; buckets[Math.floor(x * 10)]++; if (x === z) same++; }
  chk(t, Math.abs(sum / 20000 - 0.5) < 0.01 && buckets.every(n => n > 1700 && n < 2300) && same < 5, () => `prng distribution mean ${sum / 20000} buckets ${buckets}`);
  chk(t, L.makePrng(42)() === 0.6011037519201636 && L.makePrng(42)() === mulberry32(42)(), 'prng anchor and agreement with the reference mulberry32');
  t.done();
}
