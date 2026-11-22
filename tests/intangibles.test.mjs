// Intangibles and earnings page logic vs Intangibles_Template.xlsx (tests/intangibles-cases.json), plus the paper's check.
import { readFileSync } from "fs";
import { compute, industry, piece } from "../static/intangibles.js";
const cases = JSON.parse(readFileSync(new URL("./intangibles-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, w) => {
  n++;
  const nul = (x) => x === null || x === undefined;
  const ok = nul(a) ? nul(b) : typeof a === "number" ? typeof b === "number" && Math.abs(a - b) < 1e-7 : a === b;
  if (!ok) { bad++; console.log("MISMATCH", w, a, b); }
};
const READ = { barely: "Barely moves", moderate: "Moderate change", large: "Large change" };
const v = (x) => (x === undefined ? null : x);
for (const [name, c] of Object.entries(cases)) {
  const i = c.in, e = c.excel, ind = industry(i.industry);
  const x = { rev: v(i.rev), ebit: v(i.ebit), ni: v(i.ni), sga: v(i.sga), rd: v(i.rd), g: v(i.g), tax: v(i.tax), eq: v(i.eq), mcap: v(i.mcap),
    sMain: i.oMain ?? ind.sMain, sRd: i.oRd ?? ind.sRd, lMain: i.oLMain ?? ind.lMain, lRd: i.oLRd ?? ind.lRd };
  eq(x.sMain, e.sMain, name + " sMain"); eq(x.lRd, e.lRd, name + " lRd");
  const r = compute(x);
  for (const k of ["invMain", "invRd", "inv", "amortMain", "amortRd", "amort", "delta", "assetMain", "assetRd", "asset", "ebitAdj", "mBefore", "mAfter", "dm",
    "niAdj", "niChg", "eqAdj", "eqChg", "peBefore", "peAfter", "pbBefore", "pbAfter"]) eq(r[k], e[k], `${name} ${k}`);
  eq(r.band ? READ[r.band] : null, e.read, name + " reading");
}
// The paper: 30% of $1,000 of SG&A is investment, 3-year life, 10% growth -> SG&A falls about 5.1%.
const p = piece(300, 3, 0.10); eq(Math.round((300 - p.amort) / 1000 * 1000) / 10, 5.1, "paper 5.1%");
eq(piece(300, 3, 0).amort, 300, "no growth: amortization equals investment");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
