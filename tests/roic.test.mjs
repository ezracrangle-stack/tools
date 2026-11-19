// Runs every case in roic-cases.json through the web formulas and compares
// with the values ROIC_Reinvestment_Template.xlsx produced. Run: node tests/roic.test.mjs
import { readFileSync } from "node:fs";
import { compute } from "../static/roic.js";

const cases = JSON.parse(readFileSync(new URL("./roic-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];
const same = (ev, wv) => {
  if (ev === "n/m") return wv === null;
  if (ev === null) return wv === null || wv === 0;
  return typeof wv === "number" && Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev));
};
for (const [name, { inputs: i, excel }] of Object.entries(cases)) {
  const r = compute({ ...i, opc: i.opc ?? 0.02, coc: i.coc ?? null });
  for (const [k, ev] of Object.entries(excel)) {
    if (Array.isArray(ev)) ev.forEach((e, t) => {
      if (e === null && (r[k][t] === null || r[k][t] === undefined)) return;
      const ok = same(e, r[k][t]); n++; if (!ok) failures++;
      rows.push({ case: name, item: `${k}[${t}]`, excel: e, web: r[k][t], match: ok ? "yes" : "NO" });
    });
    else { const ok = same(ev, r[k]); n++; if (!ok) failures++; rows.push({ case: name, item: k, excel: ev, web: r[k], match: ok ? "yes" : "NO" }); }
  }
}
if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
else {
  rows.filter((r) => r.match === "NO").forEach((r) => console.log("MISMATCH", r));
  console.log(`${n} values checked, ${failures} mismatches`);
}
process.exit(failures ? 1 : 0);
