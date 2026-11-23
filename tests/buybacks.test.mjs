// Buybacks page logic vs Buybacks_Template.xlsx (tests/buybacks-cases.json), plus the papers' examples.
import { readFileSync } from "fs";
import { issuance, whoWins } from "../static/buybacks.js";
const cases = JSON.parse(readFileSync(new URL("./buybacks-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, w) => {
  n++;
  const nul = (x) => x === null || x === undefined;
  const ok = nul(a) ? nul(b) : typeof a === "number" ? typeof b === "number" && Math.abs(a - b) < 1e-7 : a === b;
  if (!ok) { bad++; console.log("MISMATCH", w, a, b); }
};
const v = (x) => (x === undefined ? null : x);
const Q = (q) => (q ? "SBC " + q.split("-")[0] + ", buybacks " + q.split("-")[1] : null);
const W = { sellers: "The sellers", holders: "The holders who stay", nobody: "Nobody: bought at value" };
for (const [name, c] of Object.entries(cases)) {
  const e = c.excel;
  const years = c.years.map((y) => Object.fromEntries(Object.entries(y).map(([k, x]) => [k, v(x)])));
  const r = issuance(years, v(c.start), v(c.price));
  r.rows.forEach((row, i) => { eq(row.sbcPct, e.rows[i][0], `${name} sbc${i}`); eq(row.buyPct, e.rows[i][1], `${name} buy${i}`); eq(row.avgPrice, e.rows[i][2], `${name} px${i}`); });
  eq(r.sbcAvg, e.sbcAvg, name + " sbcAvg"); eq(r.buyAvg, e.buyAvg, name + " buyAvg");
  eq(r.sbcLevel ? r.sbcLevel[0].toUpperCase() + r.sbcLevel.slice(1) : null, e.sbcLevel, name + " sbcLevel");
  eq(Q(r.quadrant), e.quadrant, name + " quadrant");
  eq(r.tsr ? r.tsr[0] : null, e.tsrAvg, name + " tsrAvg"); eq(r.tsr ? r.tsr[1] : null, e.tsrMed, name + " tsrMed");
  eq(r.end, e.end, name + " end"); eq(r.dilution, e.dilution, name + " dilution");
  eq(r.sbcTot, e.sbcTot, name + " sbcTot"); eq(r.buyTot, e.buyTot, name + " buyTot"); eq(r.net, e.net, name + " net");
  eq(r.offset, e.offset, name + " offset"); eq(r.paid, e.paid, name + " paid"); eq(r.vsToday, e.vsToday, name + " vsToday");
  const w = whoWins(...c.b.map(v));
  eq(w.before, e.before, name + " before"); eq(w.ratio, e.ratio, name + " ratio");
  for (const k of ["bought", "left", "after", "sellers", "holders", "moved"]) eq(w.ok ? w[k] : null, e[k], `${name} ${k}`);
  eq(w.ok ? W[w.winner] : null, e.winner, name + " winner");
}
// The papers: dilution 1,000 -> 1,100 shares is 9.1%; Exhibit 39 at $200 and $50.
eq(Math.round(issuance([{ shares: 1100 }], 1000).dilution * 1000) / 10, 9.1, "paper dilution 9.1%");
eq(Math.round(whoWins(100000, 1000, 200, 20000).holders * 100) / 100, -11.11, "Exhibit 39 at $200");
eq(Math.round(whoWins(100000, 1000, 50, 20000).holders * 100) / 100, 33.33, "Exhibit 39 at $50");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
