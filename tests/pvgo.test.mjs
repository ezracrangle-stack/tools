// PVGO page logic vs PVGO_Template.xlsx (tests/pvgo-cases.json), plus the paper's examples.
import { readFileSync } from "fs";
import { fromEarnings, fromNopat, nopatHelper } from "../static/pvgo.js";
const cases = JSON.parse(readFileSync(new URL("./pvgo-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, w) => {
  n++;
  const nul = (x) => x === null || x === undefined;
  const ok = nul(a) ? nul(b) : typeof b === "number" && Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b));
  if (!ok) { bad++; console.log("MISMATCH", w, a, b); }
};
const v = (x) => (x === undefined ? null : x);
for (const [name, c] of Object.entries(cases)) {
  const e = c.excel, A = fromEarnings(...c.a.map(v));
  const H = nopatHelper(...c.h.map(v)); eq(H.nopat, e.hnopat, name + " helper nopat");
  const used = v(c.b[0]) !== null ? c.b[0] : H.nopat; eq(used, e.used, name + " nopat used");
  const B = fromNopat(used, ...c.b.slice(1).map(v));
  ["ssPE", "pe", "ss", "pvgo", "share", "ssShare"].forEach((k, i) => eq(A[k], e.a[i], `${name} A ${k}`));
  A.sens.forEach(([r, s], i) => { eq(r, e.asens[i][0], `${name} A rate${i}`); eq(s, e.asens[i][1], `${name} A sens${i}`); });
  ["ev", "ssEq", "pvgo", "share", "ssShare"].forEach((k, i) => eq(B[k], e.b[i], `${name} B ${k}`));
  B.sens.forEach(([r, s], i) => { eq(r, e.bsens[i][0], `${name} B rate${i}`); eq(s, e.bsens[i][1], `${name} B sens${i}`); });
}
// The paper: 8.75% cost of equity gives a steady-state P/E of 11.4; NOPAT 100, WACC 8%, net debt 250, equity 1,500: PVGO 500 (33%).
eq(Math.round(fromEarnings(1, 0.0875, 21.9).ssPE * 10) / 10, 11.4, "paper steady-state P/E");
const p = fromNopat(100, 0.08, 250, 1500); eq(p.pvgo, 500, "paper PVGO"); eq(Math.round(p.share * 100), 33, "paper PVGO %");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
