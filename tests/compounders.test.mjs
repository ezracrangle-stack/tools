// Runs every case in compounders-cases.json through the web formulas and compares
// with the values Pay_For_Quality_Template.xlsx produced. Run: node tests/compounders.test.mjs
import { readFileSync } from "node:fs";
import { compute, ROICS, GROWTHS, ROES, RRS } from "../static/compounders.js";

const cases = JSON.parse(readFileSync(new URL("./compounders-cases.json", import.meta.url)));
let failures = 0, n = 0;
const rows = [];
for (const [name, { inputs: i, excel }] of Object.entries(cases)) {
  const pad = (a, len) => Array.from({ length: len }, (_, k) => (a[k] === undefined ? null : a[k]));
  const x = { r: i.r, ro: i.ro, g: i.g, n: i.n, mpe: i.mpe || 0, cpe: i.cpe || 0, rr: i.rr, roe: i.roe, k: i.k, hy: i.hy, xpe: i.xpe || 0, fpe2: i.fpe2 || 0,
    roics: pad(i.mc || ROICS, 5), growths: pad(i.mg || GROWTHS, 5), roes: pad(i.fe || ROES, 11), rrs: pad(i.fr || RRS, 3) };
  const r = compute(x);
  const web = { vng: r.vng, v: r.v, mult: r.mult, prem: r.prem, fromGrowth: r.fromGrowth, reinv: r.reinv, jpe: r.jpe, paying: r.paying, room: r.room };
  r.matrix.forEach((row, a) => row.forEach((v, b) => { web[`pm${a + 1}${b + 1}`] = v; }));
  const f = r.fair;
  Object.assign(web, f ? { fg: f.g, fexit: f.exit, fdiv: f.div, fsale: f.sale, fpe: f.pe, fen: f.eN, fvs: f.vs } : { fg: null, fexit: 1 / x.k, fdiv: null, fsale: null, fpe: null, fen: null, fvs: null });
  r.grid.forEach((row, a) => row.forEach((v, b) => { web[`fp${a + 1}${b + 1}`] = v; }));
  for (const [k, ev] of Object.entries(excel)) {
    const wv = web[k];
    let ok;
    if (ev === "n/m") ok = wv === null;
    else if (ev === null) ok = wv === null || wv === undefined;
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
