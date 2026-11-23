// Base rates page logic vs Base_Rates_Template.xlsx (tests/baserates-cases.json), plus the paper's figures.
import { readFileSync } from "fs";
import { baseRate, SHARES, STATS } from "../static/baserates.js";
const cases = JSON.parse(readFileSync(new URL("./baserates-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, w) => {
  n++;
  const nul = (x) => x === null || x === undefined;
  const ok = nul(a) ? nul(b) : typeof b === "number" ? Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)) : a === b;
  if (!ok) { bad++; console.log("MISMATCH", w, a, b); }
};
for (const [name, c] of Object.entries(cases)) {
  const r = baseRate(...c.in.map((x) => (x === undefined ? null : x))), e = c.excel;
  eq(r.s2015, e.s2015, name + " s2015"); eq(r.cls === null ? null : r.cls + 1, e.cls, name + " class");
  eq(r.band === null ? null : r.band + 1, e.band, name + " band");
  for (const k of ["className", "real", "bandLabel", "inBand", "orFaster", "faster", "median", "mean", "sd"]) eq(r[k], e[k], `${name} ${k}`);
}
// Every distribution adds to 100%. The paper's 3-year example: 15-20% growth for the full universe is 6.7% (here: by class).
SHARES.forEach((hz, h) => hz.forEach((d, k) => eq(Math.round(d.reduce((a, x) => a + x, 0) * 1e9) / 1e9, 1, `sum h${h} k${k}`)));
// Tesla example in the paper: $4.5-7 billion class, 10 years, 45% or more: 0%.
eq(baseRate(6000, 1, 10, 0.5, 0).orFaster, 0, "paper: nobody grew 45%+ for 10 years from $4.5-7 billion");
eq(STATS[1][10][0], 0.015, "mega 3-year median 1.5%");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
