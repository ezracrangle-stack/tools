// Runs every case in cscore-cases.json through the web formulas and compares
// with the values CScore_Template.xlsx produced. Run: node tests/cscore.test.mjs
import { readFileSync } from "node:fs";
import { compute, READ, ITEMS } from "../static/cscore.js";

const cases = JSON.parse(readFileSync(new URL("./cscore-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];
for (const [name, c] of Object.entries(cases)) {
  const norm = (y) => Object.fromEntries(ITEMS.map((k) => [k, y[k] === undefined ? null : y[k]]));
  const r = compute(norm(c.y0), norm(c.y1), c.hi, c.mcap || 0);
  const web = {};
  r.rows.forEach((x) => { if (x.k !== "ta") web[x.k + "0"] = x.a; web[x.k + "1"] = x.b; web[x.k + "f"] = x.flag; });
  web.scored = r.scored; web.ps = r.ps;
  web.score = r.score !== null ? r.score : r.scored ? `${r.up} of ${r.scored}` : null;
  web.reading = r.score !== null ? READ[r.band](r.score) : r.scored ? "Fill in both years for every line to get the full score." : null;
  web.short = r.short === null ? null : r.short ? "Yes: Montier's short candidate" : "No";
  for (const [k, ev] of Object.entries(c.excel)) {
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
