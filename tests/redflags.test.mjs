// Red flags page logic vs RedFlags_Template.xlsx (tests/redflags-cases.json) and the C-Score cases (tests/cscore-cases.json).
import { readFileSync } from "fs";
import { compute, cscore } from "../static/redflags.js";
const load = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, what) => {
  n++;
  const ok = (a === null || a === undefined) ? (b === null || b === undefined) : typeof a === "number" ? typeof b === "number" && Math.abs(a - b) < 1e-7 : a === b;
  if (!ok) { bad++; console.log("MISMATCH", what, a, b); }
};
const fill = (y) => Object.fromEntries(Object.entries(y).map(([k, v]) => [k, v === undefined ? null : v]));
for (const [name, c] of Object.entries(load("./redflags-cases.json"))) {
  const r = compute(fill(c.y0), fill(c.y1), c.hi, c.mcap || 0), e = c.excel;
  r.c.rows.forEach((row) => {
    if (row.k !== "ta") eq(row.a, e[`c${row.k}0`], `${name} c${row.k}0`);
    eq(row.b, e[`c${row.k}1`], `${name} c${row.k}1`); eq(row.flag, e[`c${row.k}f`], `${name} c${row.k}f`);
  });
  eq(r.c.scored, e.cscored, name + " cscored");
  eq(r.c.score === null ? (r.c.scored ? `${r.c.up} of ${r.c.scored}` : null) : r.c.score, e.cscore, name + " cscore");
  eq(r.c.band === null ? (r.c.scored ? "Incomplete" : null) : { high: "High", middling: "Middling", low: "Low" }[r.c.band], e.cread, name + " cread");
  for (const k of ["dsri", "gmi", "aqi", "sgi", "depi", "sgai", "tata", "lvgi"]) eq(r.b.idx[k], e["b" + k], `${name} ${k}`);
  eq(r.b.done, e.bdone, name + " bdone"); eq(r.b.m, e.bm, name + " M");
  eq(r.b.band === null ? null : { above: "Above -1.78", grey: "Grey zone", below: "Below -2.22" }[r.b.band], e.bread, name + " bread");
  r.s.rows.forEach((row) => {
    eq(row.a, e[`s${row.k}0`], `${name} s${row.k}0`); eq(row.b, e[`s${row.k}1`], `${name} s${row.k}1`); eq(row.flag, e[`s${row.k}f`], `${name} s${row.k}f`);
  });
  eq(r.s.run, e.srun, name + " srun"); eq(r.s.run ? `${r.s.up} of ${r.s.run}` : null, e.sup, name + " sup");
  eq(r.ps, e.ps, name + " ps"); eq(r.short === null ? null : r.short ? "Yes" : "No", e.short, name + " short");
}
// The original C-Score cases still hold.
for (const [name, c] of Object.entries(load("./cscore-cases.json"))) {
  const r = cscore(fill(c.y0), fill(c.y1), c.hi), e = c.excel;
  r.rows.forEach((row) => { eq(row.flag, e[`${row.k}f`], `cscore ${name} ${row.k}`); });
  eq(r.score, typeof e.score === "number" ? e.score : null, `cscore ${name} score`);
}
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
