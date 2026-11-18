// Runs every case in penman-cases.json through the web formulas and compares
// with the values Penman_Residual_Income_Template.xlsx produced. Run: node tests/penman.test.mjs
import { readFileSync } from "node:fs";
import { compute, helperBS, helperOI } from "../static/penman.js";

const cases = JSON.parse(readFileSync(new URL("./penman-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];
for (const [name, { inputs: i, excel }] of Object.entries(cases)) {
  const x = { sh: i.sh, p: i.p, r: i.r, gdp: i.gdp, bond: i.bond ?? null, eq: i.eq ?? null };
  if (i.bs) { const A = helperBS(i.bs.oa, i.bs.ol, i.bs.fa, i.bs.fo, i.bs.mi); Object.assign(x, { noa: A.noa, nfo: A.nfo, mi: A.mi }); }
  else Object.assign(x, { noa: i.noa, nfo: i.nfo, mi: i.mi });
  x.oi = i.hoi ? helperOI(i.hoi.rev, i.hoi.ebit, i.hoi.tax, i.hoi.gr).oi : i.oi;
  const r = compute(x);
  Object.assign(r, { oi: x.oi, noa: x.noa, nfo: x.nfo, mi: x.mi });
  r.profile.forEach((v, k) => { r["pf" + k] = v; });
  for (const [k, ev] of Object.entries(excel)) {
    let wv = r[k];
    const ok = ev === "n/m" ? wv === null : ev === null ? wv === null || wv === 0 : Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev));
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
