// Runs every case in net-net-cases.json through the web formulas and compares
// with the values the Excel template produced. Run: node tests/net-net.test.mjs
import { readFileSync } from "node:fs";
import { compute, DEFAULTS } from "../static/net-net.js";

const cases = JSON.parse(readFileSync(new URL("./net-net-cases.json", import.meta.url)));
const U = 1000; // the cases are in thousands, like most 10-Ks
const word = { pass: "Passes", fail: "Fails", negative: "Fails:" };
let failures = 0;
const rows = [];

for (const [name, { inputs, excel }] of Object.entries(cases)) {
  const x = { ...DEFAULTS, mc: null, ev: null };
  for (const k of ["c", "s", "r", "ar", "in", "pp", "ca", "a", "cl", "d", "l", "ob", "pf", "g", "ia", "rou"]) x[k] = (inputs[k] || 0) * U;
  x.sh = inputs.sh * U; x.p = inputs.p;
  const r = compute(x);
  const web = {
    totalCash: r.totalCash / U, otherCA: r.otherCA / U, mcap: r.mcap / U, ev: r.ev / U,
    graham: r.graham, modern: r.modern,
  };
  for (const k of ["ncav", "adj", "netCash", "wc", "schloss", "bv", "abv", "nnwc"]) {
    web[k] = r.totals[k] / U; web[k + "_ps"] = r.ps[k];
    if (excel[k + "_r"] !== undefined) web[k + "_r"] = r.ratio[k] ?? "n/m";
  }
  for (const [k, ev] of Object.entries(excel)) {
    const wv = web[k];
    let ok;
    if (k === "graham" || k === "modern") ok = String(ev).startsWith(word[wv]);
    else if (ev === "n/m") ok = wv === "n/m";
    else ok = Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev));
    if (!ok) failures++;
    rows.push({ case: name, item: k, excel: ev, web: wv, match: ok ? "yes" : "NO" });
  }
}
if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
else console.log(`${rows.length} values checked, ${failures} mismatches`);
process.exit(failures ? 1 : 0);
