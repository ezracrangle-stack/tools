// Runs every case in greenwald-cases.json through the web formulas and compares
// with the values Greenwald_EPV_Template.xlsx produced. Run: node tests/greenwald.test.mjs
import { readFileSync } from "node:fs";
import { compute, helperMargin, helperCapex, ASSETS, DEFAULTS } from "../static/greenwald.js";

const cases = JSON.parse(readFileSync(new URL("./greenwald-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];

for (const [name, { inputs: i, excel }] of Object.entries(cases)) {
  // Amounts and shares are both in millions in the Excel cases; per-share figures only need the same unit.
  const x = { ...i };
  for (const k of ["ke", "cap", "opc", "ry"]) if (x[k] === null) x[k] = DEFAULTS[k];
  for (const k of ASSETS) { x["r" + k] = i["r" + k] ?? null; x["l" + k] = i["l" + k] ?? null; }
  const r = compute(x);
  const v = (k) => (i[k] === null || i[k] === undefined ? null : i[k]);
  const T = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const A = helperMargin(T.map((n) => v("he" + n)), T.map((n) => v("hr" + n)));
  const B = helperCapex(v("hppe") || 0, v("hrev") || 0, v("hint"), [1, 2, 3].map((n) => v("hc" + n)), [1, 2, 3].map((n) => v("hd" + n)));
  Object.assign(r, { h_ebit: A.ebit, h_margin: A.margin, h_int: B.intensity, h_mcx: B.mcx });
  for (const [k, ev] of Object.entries(excel)) {
    const wv = r[k];
    const ok = typeof ev === "string" ? wv === ev : Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev));
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
