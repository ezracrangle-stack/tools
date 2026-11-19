// Runs every case in dhandho-cases.json through the web formulas and compares
// with the values Dhandho_Bet_Template.xlsx produced. Run: node tests/dhandho.test.mjs
import { readFileSync } from "node:fs";
import { compute } from "../static/dhandho.js";

const cases = JSON.parse(readFileSync(new URL("./dhandho-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];
for (const [name, { inputs: i, excel }] of Object.entries(cases)) {
  const outcomes = Array.from({ length: 6 }, (_, k) => {
    const o = i.out[k];
    return o ? { p: o[0], r: o[1], v: o[2] } : { p: null, r: null, v: null };
  });
  const bets = Array.from({ length: 8 }, (_, k) => (i.bets[k] === undefined ? null : i.bets[k]));
  const r = compute({ price: i.price || 0, yrs: i.yrs, cap: i.cap, outcomes, bets });
  const web = { total: r.total, edge: r.edge, mult: r.mult, yearly: r.yearly, lose: r.lose, wipe: r.wipe, best: r.best, worst: r.worst,
    shortcut: r.shortcut, kelly: r.kelly, half: r.half, position: r.position, sum: r.sum };
  r.out.forEach((o, k) => { web["r" + (k + 1)] = o.r; });
  r.scaled.forEach((v, k) => { web["s" + (k + 1)] = v; });
  r.capped.forEach((v, k) => { web["c" + (k + 1)] = v; });
  for (const [k, ev] of Object.entries(excel)) {
    const wv = web[k];
    let ok;
    if (ev === null) ok = wv === null || wv === undefined;
    else ok = typeof wv === "number" && Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev));
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
