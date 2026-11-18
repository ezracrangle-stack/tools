// Runs every case in graham-cases.json through the web formulas and compares
// with the values Graham_Formulas_Template.xlsx produced. Run: node tests/graham.test.mjs
import { readFileSync } from "node:fs";
import { compute, helperEPS, helperBV } from "../static/graham.js";

const cases = JSON.parse(readFileSync(new URL("./graham-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];
for (const [name, { inputs, helpers: h, excel }] of Object.entries(cases)) {
  const r = compute(inputs);
  const A = helperEPS(h.eps10);
  Object.assign(r, { h_avg3: A.avg3, h_avg810: A.avg810, h_pos: A.pos, h_g: A.g, h_bv: helperBV(h.eq ?? 0, h.shares ?? 0) });
  for (const [k, ev] of Object.entries(excel)) {
    const wv = r[k];
    const ok = typeof ev === "string" ? (ev === "n/m" ? wv === null || wv === "n/m" : wv === ev) : Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev));
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
