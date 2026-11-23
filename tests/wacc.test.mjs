// WACC page logic vs WACC_Template.xlsx (tests/wacc-cases.json), plus the paper's examples.
import { readFileSync } from "fs";
import { wacc } from "../static/wacc.js";
const cases = JSON.parse(readFileSync(new URL("./wacc-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, w) => {
  n++;
  const nul = (x) => x === null || x === undefined;
  const ok = nul(a) ? nul(b) : typeof b === "number" ? Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)) : a === b;
  if (!ok) { bad++; console.log("MISMATCH", w, a, b); }
};
const C = (x) => (x === null ? null : x ? "OK: equity costs more than debt" : "Cost of equity below cost of debt: recheck");
for (const [name, c] of Object.entries(cases)) {
  const i = Object.fromEntries(Object.entries(c.in).map(([k, x]) => [k, x === undefined ? null : x]));
  const r = wacc(i), e = c.excel;
  for (const k of ["relevered", "beta", "ke", "kdAfter", "wd", "we", "de", "wacc", "ownVsWacc", "ownVsRf"]) eq(r[k], e[k], `${name} ${k}`);
  eq(C(r.check), e.check, name + " check");
  r.grid.forEach((row, a) => row.forEach((x, b) => eq(x, e.grid[a][b], `${name} grid ${a}${b}`)));
}
// The paper: adjusted beta 1.22 -> 1.15; relevered 1.05 at 20% tax and 25/75 -> 1.33; WACC of 5% debt and 10% equity at 20/80 -> 9.0%.
const r2 = (x) => Math.round(x * 100) / 100;
eq(r2(wacc({ beta: 1.22, rf: 0, erp: 0 }).beta), 1.15, "paper adjusted beta");
eq(r2(wacc({ ubeta: 1.05, tax: 0.2, equity: 75, debt: 25, rf: 0, erp: 0 }).beta), 1.33, "paper relevered beta");
eq(r2(wacc({ rf: 0.10, erp: 0, beta: 1, adjust: false, kd: 0.05, tax: 0, equity: 80, debt: 20 }).wacc * 100), 9, "paper WACC 9%");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
