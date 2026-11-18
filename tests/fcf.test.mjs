// Runs every case in fcf-cases.json through the web formulas and compares
// with the values Mauboussin_FCF_Template.xlsx produced. Run: node tests/fcf.test.mjs
import { readFileSync } from "node:fs";
import { compute, helperIntangibles } from "../static/fcf.js";

const cases = JSON.parse(readFileSync(new URL("./fcf-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];
for (const [name, { inputs: i, excel }] of Object.entries(cases)) {
  const H = helperIntangibles(i.hl);
  // When the sheet takes intangibles from Helper A, the page's helper writes the same figures into the fields.
  const x = { ...i, lease: (i.fl || 0) + (i.fo || 0), ii: i.ii ?? H.I, ia: i.ia ?? H.A };
  const r = compute(x);
  Object.assign(r, { hI: H.I, hA: H.A });
  for (const [k, ev] of Object.entries(excel)) {
    const wv = r[k];
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
