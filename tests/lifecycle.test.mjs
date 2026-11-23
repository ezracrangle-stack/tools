// Life cycle page logic vs Life_Cycle_Template.xlsx (tests/lifecycle-cases.json), plus the paper's Amazon example.
import { readFileSync } from "fs";
import { lifecycle } from "../static/lifecycle.js";
const cases = JSON.parse(readFileSync(new URL("./lifecycle-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, w) => {
  n++;
  const nul = (x) => x === null || x === undefined;
  const ok = nul(a) ? nul(b) : typeof b === "number" ? Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b)) : a === b;
  if (!ok) { bad++; console.log("MISMATCH", w, a, b); }
};
for (const [name, c] of Object.entries(cases)) {
  const years = c.years.map((y) => Object.fromEntries(Object.entries(y).map(([k, x]) => [k, x === undefined ? null : x])));
  const r = lifecycle(years), e = c.excel;
  r.rows.forEach((row, i) => ["op", "inv", "fin", "signs", "stage"].forEach((k, j) => eq(row[k], e.rows[i][j], `${name} y${i} ${k}`)));
  eq(r.latest, e.latest, name + " latest"); eq(r.earlier, e.earlier, name + " earlier"); eq(r.pathTsr, e.path, name + " path");
  for (let j = 0; j < 5; j++) { eq(r.profile ? r.profile[j] : null, e.profile[j], `${name} profile${j}`); eq(r.odds ? r.odds[j] : null, e.odds[j], `${name} odds${j}`); eq(r.tsrByEnd ? r.tsrByEnd[j] : null, e.tsr[j], `${name} tsr${j}`); }
}
// The paper (Exhibit 4): Amazon 2022 adjusted to 105.6 / -145.0 / 29.3, growth stage.
const a = lifecycle([{ cfo: 46.8, cfi: -37.6, cff: 9.7, sbc: 19.6, intang: 78.4, bought: 10.0, sold: 39.0 }]).rows[0];
eq(Math.round(a.op * 10) / 10, 105.6, "Amazon operating"); eq(Math.round(a.inv * 10) / 10, -145, "Amazon investing");
eq(Math.round(a.fin * 10) / 10, 29.3, "Amazon financing"); eq(a.stage, "Growth", "Amazon stage");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
