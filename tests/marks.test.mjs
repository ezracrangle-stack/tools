// Runs every case in marks-cases.json through the web formulas and compares
// with the values Market_Temperature_Template.xlsx produced. Run: node tests/marks.test.mjs
import { readFileSync } from "node:fs";
import { compute, READING } from "../static/marks.js";

const cases = JSON.parse(readFileSync(new URL("./marks-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];
for (const [name, { answers, excel }] of Object.entries(cases)) {
  const r = compute(answers);
  const web = { n: r.n, hot: r.hot, mid: r.mid, cold: r.cold, temp: r.temp, reading: r.band ? READING[r.band] : null, stance: r.stance, qualities: r.qualities, mistakes: r.mistakes };
  for (const [k, ev] of Object.entries(excel)) {
    const wv = web[k];
    const ok = typeof ev === "number" ? typeof wv === "number" && Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev)) : ev === wv;
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
