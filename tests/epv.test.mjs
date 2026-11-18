// Runs every case in epv-cases.json through the web formulas and compares
// with the values Oakley_EPV_Template.xlsx produced. Run: node tests/epv.test.mjs
import { readFileSync } from "node:fs";
import { compute } from "../static/epv.js";

const cases = JSON.parse(readFileSync(new URL("./epv-cases.json", import.meta.url)));
const MONEY = ["ebit", "rs", "imp", "iw", "tc", "ls", "gs", "oo", "da", "mcx", "lease", "debt", "pen", "pref", "mi", "cash", "onc"];
const AMOUNTS = ["nebit", "pre", "taxAmt", "cp", "ev", "epv", "oe"];
const word = {
  rule: { pass: "Passes", fail: "Fails", negative: "Fails: cash profits negative" },
  sell: { sell: "Consider selling", none: "No signal", "n/m": "n/m" },
};
let failures = 0, n = 0;
const rows = [];

for (const [name, { units: U, inputs: i, excel }] of Object.entries(cases)) {
  const x = {};
  for (const k of MONEY) x[k] = (i[k] || 0) * U;
  for (const k of ["tax", "r", "ty", "bond", "infl", "spr", "buf"]) x[k] = i[k] || 0;
  x.sh = i.sh * U; x.wsh = (i.wsh || 0) * U; x.p = i.p;
  x.ni = i.ni === null || i.ni === undefined ? null : i.ni * U;
  const r = compute(x);
  for (const [k, ev] of Object.entries(excel)) {
    let wv = r[k], ok;
    if (k in word) { wv = word[k][wv]; ok = wv === ev; }
    else if (ev === "n/m") ok = wv === null;
    else {
      if (AMOUNTS.includes(k)) wv = wv / U;
      ok = Math.abs(ev - wv) < 1e-9 * Math.max(1, Math.abs(ev));
    }
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
