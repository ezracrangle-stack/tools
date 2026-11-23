// Where the money went: page logic vs Capital_Allocation_Template.xlsx (tests/capalloc-cases.json).
import { readFileSync } from "fs";
import { compute } from "../static/capalloc.js";
const cases = JSON.parse(readFileSync(new URL("./capalloc-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, w) => {
  n++;
  const nul = (x) => x === null || x === undefined;
  const ok = nul(a) ? nul(b) : typeof b === "number" && Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b));
  if (!ok) { bad++; console.log("MISMATCH", w, a, b); }
};
const v = (x) => (x === undefined ? null : x);
const SRC = ["ops", "sold", "debtIn", "issued"], USE = ["capex", "acq", "nwc", "div", "buy", "debtOut"];
for (const [name, c] of Object.entries(cases)) {
  const e = c.excel;
  const years = c.years.map((y) => Object.fromEntries(Object.entries(y).map(([k, x]) => [k, v(x)])));
  const r = compute(years, v(c.rev0));
  SRC.forEach((k, i) => { eq(r.sources[k], e.src[i] ?? 0, `${name} src ${k}`); eq(r.srcPct[k], e.srcPct[i], `${name} srcPct ${k}`); });
  USE.forEach((k, i) => { eq(r.uses[k], e.use[i] ?? 0, `${name} use ${k}`); eq(r.usePct[k], e.usePct[i], `${name} usePct ${k}`); });
  eq(r.srcTot, e.srcTot ?? 0, name + " srcTot"); eq(r.useTot, e.useTot ?? 0, name + " useTot"); eq(r.left, e.left ?? 0, name + " left");
  r.net.forEach((x, i) => eq(x, e.net[i], `${name} net${i}`));
  for (const k of ["selfFunded", "invested", "returnedAll", "dSales", "mna", "fixed", "wc", "returned", "fromDiv", "fromBuy", "payout", "yield", "divRange", "netRange"])
    eq(r[k], k === "returned" ? e[k] ?? 0 : e[k], `${name} ${k}`);
}
// The paper's arithmetic: working capital up 200 on 1,000 of new sales is 20%; capex 500, depreciation 200: 30%.
const p = compute([{ rev: 2000, nwc: 200, capex: 500, da: 200 }], 1000);
eq(p.wc, 0.2, "paper working capital rate"); eq(p.fixed, 0.3, "paper fixed capital rate");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
