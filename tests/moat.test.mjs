// Measuring the moat page logic vs Measuring_The_Moat_Template.xlsx (tests/moat-cases.json).
import { readFileSync } from "fs";
import { drivers, shares } from "../static/moat.js";
const cases = JSON.parse(readFileSync(new URL("./moat-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, w) => {
  n++;
  const ok = (a === null || a === undefined) ? (b === null || b === undefined) : typeof a === "number" ? typeof b === "number" && Math.abs(a - b) < 1e-7 : a === b;
  if (!ok) { bad++; console.log("MISMATCH", w, a, b); }
};
const SRC = { none: "No ROIC edge over peers", both: "Both: margin and turnover", margin: "Margin: differentiation", turnover: "Turnover: cost leadership" };
const nul = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === undefined ? null : v]));
for (const [name, c] of Object.entries(cases)) {
  const e = c.excel;
  const d = drivers(c.cos.map(nul), c.wacc);
  d.rows.forEach((r, i) => { ["margin", "turn", "roic", "spread"].forEach((k, j) => eq(r[k], e.rows[i][j], `${name} ${k}${i}`)); });
  eq(d.peer.n, e.peer[0], name + " peers"); eq(d.peer.n ? d.peer.rev : 0, e.peer[1], name + " prev");
  eq(d.peer.margin, e.peer[4], name + " pm"); eq(d.peer.turn, e.peer[5], name + " pt"); eq(d.peer.roic, e.peer[6], name + " pr");
  eq(d.gap, e.gap, name + " gap"); eq(d.mr, e.mr, name + " mr"); eq(d.tr, e.tr, name + " tr");
  eq(d.source ? SRC[d.source] : null, e.src, name + " src");
  const s = shares(c.shares.map(nul));
  s.rows.forEach((r, i) => { eq(r.sa, e.srows[i][0], `${name} sa${i}`); eq(r.sb, e.srows[i][1], `${name} sb${i}`); eq(r.ch, e.srows[i][2], `${name} ch${i}`); });
  eq(s.n, e.n, name + " n"); eq(s.avg, e.avg, name + " avg"); eq(s.stable === null ? null : s.stable ? "Stable" : "Unstable", e.stab, name + " stab");
  eq(s.hhiA, e.hhiA, name + " hhiA"); eq(s.hhiB, e.hhiB, name + " hhiB");
  eq(s.high === null ? null : s.high ? "Highly concentrated" : "Not highly concentrated", e.conc, name + " conc");
  eq(s.top4A, e.top4A, name + " top4A"); eq(s.top4B, e.top4B, name + " top4B");
}
// Mauboussin's Exhibit 13 (rounded shares in, so the book's 1% and 3% within rounding)
const ex13 = (rows) => shares(rows.map(([a, b]) => ({ a, b }))).avg;
const search = ex13([[87, 89], [7, 7], [5, 3], [1, 2], [0, 0]]), social = ex13([[69, 66], [13, 7], [7, 10], [7, 4], [2, 12], [1, 0], [1, 1], [1, 1]]);
eq(Math.round(search * 100), 1, "book search 1%"); eq(Math.round(social * 100), 3, "book social media 3%");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
