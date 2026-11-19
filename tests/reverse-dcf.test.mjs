// Runs every case in reverse-dcf-cases.json through the web formulas and compares
// with the values Reverse_DCF_Template.xlsx produced. Run: node tests/reverse-dcf.test.mjs
import { readFileSync } from "node:fs";
import { compute, helperHistory, helperWacc } from "../static/reverse-dcf.js";

const cases = JSON.parse(readFileSync(new URL("./reverse-dcf-cases.json", import.meta.url)));
const GROW = { yes: "Yes.", no: "No.", zero: "It adds", untested: "Not tested" };
let failures = 0, n = 0;
const rows = [];
for (const [name, { inputs: i, excel }] of Object.entries(cases)) {
  const r = compute({ sh: i.sh, p: i.p, s0: i.s0, debt: i.debt, cash: i.cash, g: i.g, m: i.m, t: i.t, inv: i.inv, r: i.r, cg: i.cg, n: i.n });
  const web = { mcap: r.mcap, ev: r.ev, v0: r.v0, yrs: r.yrs, vyr: r.vyr, tm: r.tm, grow: r.grow, ig: r.ig };
  r.ps.forEach((v, k) => { web["ps" + k] = v; });
  const H = i.hist ? helperHistory(i.hist) : helperHistory({ sales: [null, null, null, null], oi: [null, null, null], capex: [null, null, null], da: [null, null, null], wc: [null, null, null], tax: [null, null, null], pti: [null, null, null] });
  Object.assign(web, H);
  const w = i.wacc;
  Object.assign(web, w ? helperWacc(w.rf, w.beta, w.erp, w.kd, w.tax, w.w) : helperWacc(null, null, null, null, null, null));
  for (const [k, ev] of Object.entries(excel)) {
    const wv = web[k];
    let ok;
    if (k === "grow") ok = typeof ev === "string" && ev.startsWith(GROW[wv]);
    else if (k === "yrs" && typeof ev === "string") ok = wv === null;
    else if (k === "ig" && typeof ev === "string") ok = wv === null;
    else if (ev === "n/m") ok = wv === "n/m";
    else if (ev === null) ok = wv === null;
    else ok = typeof wv === "number" && Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev));
    n++; if (!ok) failures++;
    rows.push({ case: name, item: k, excel: ev, web: wv, match: ok ? "yes" : "NO" });
  }
}
if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
else {
  rows.filter((r) => r.match === "NO").forEach((r) => console.log("MISMATCH", r));
  console.log(`${n} values checked, ${failures} mismatches`);
}
process.exit(failures ? 1 : 0);
