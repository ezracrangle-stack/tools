// Runs every case in lynch-cases.json through the web formulas and compares
// with the values Lynch_PE_Growth_Template.xlsx produced. Run: node tests/lynch.test.mjs
import { readFileSync } from "node:fs";
import { compute, helperGrowth } from "../static/lynch.js";

const cases = JSON.parse(readFileSync(new URL("./lynch-cases.json", import.meta.url)));
const PEG = { "very positive": "Very positive", "below growth": "P/E below", fair: "About fairly", pricey: "P/E above", "very negative": "Very negative" };
const DIV = { poor: "Poor", between: "Between", okay: "Okay", "looking for": "What you" };
let failures = 0, n = 0;
const rows = [];
for (const [name, { inputs: i, excel }] of Object.entries(cases)) {
  const r = compute({ price: i.price, eps: i.eps, g: i.g, dps: i.dps || 0, cash: i.cash, yrs: i.yrs, peEnd: i.peEnd || 0 });
  const eps = Array.from({ length: 6 }, (_, k) => (i.he[k] === undefined ? null : i.he[k]));
  const H = helperGrowth(eps);
  const web = { ...r, n: H.n, first: H.first, last: H.last, hyrs: H.yrs, cagr: H.cagr };
  H.changes.forEach((v, k) => { web["chg" + (k + 2)] = v; });
  for (const [k, ev] of Object.entries(excel)) {
    const wv = web[k];
    let ok;
    if (k === "pegText") ok = r.pegR === null ? ev.startsWith("n/m") : ev.startsWith(PEG[r.pegR]);
    else if (k === "divText") ok = r.divR === null ? ev === null : ev.startsWith(DIV[r.divR]);
    else if (ev === null) ok = wv === null || wv === undefined;
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
