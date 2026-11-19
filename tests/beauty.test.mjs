// Beauty contest arithmetic vs an exact (fractions) Python reference: tests/beauty-cases.json.
import { readFileSync } from "fs";
import { summarize, valid, level, roundOf } from "../static/beauty.js";
const cases = JSON.parse(readFileSync(new URL("./beauty-cases.json", import.meta.url)));
let n = 0, bad = 0;
const eq = (a, b, what) => { n++; const ok = typeof a === "number" ? Math.abs(a - b) < 1e-9 : JSON.stringify(a) === JSON.stringify(b); if (!ok) { bad++; console.log("MISMATCH", what, a, b); } };
for (const c of cases) {
  const r = summarize(c.g);
  eq(r.n, c.g.length, "n"); eq(r.avg, c.avg, "avg"); eq(r.target, c.target, "target");
  eq(r.win, c.win, "win " + c.g); eq(r.winners, c.winners, "winners"); eq(r.hist, c.hist, "hist");
}
eq(valid("17"), 17, "valid"); eq(valid("101"), null, "101"); eq(valid("4.5"), null, "dec"); eq(valid(""), null, "blank"); eq(valid(" 0 "), 0, "zero");
eq(level(50).k, 0, "L0"); eq(level(33).k, 1, "L1"); eq(level(22).k, 2, "L2"); eq(level(15).k, 3, "L3"); eq(level(10).k, 4, "L4");
eq(level(1).k, 5, "L5"); eq(level(0).k, "zero", "zero"); eq(level(70).k, null, "70");
eq(roundOf(new Date(Date.UTC(2026, 10, 30, 23, 59))), "2026-11", "round end"); eq(roundOf(new Date(Date.UTC(2026, 11, 1))), "2026-12", "round next");
console.log(`${n} values checked, ${bad} mismatches`);
if (bad) process.exit(1);
