// Red flags: three accounting checks on one set of two-year numbers. Same arithmetic as RedFlags_Template.xlsx.
// A. Montier's C-Score, Value Investing (2009), ch. 25.
// B. Beneish's M-Score, "The Detection of Earnings Manipulation", Financial Analysts Journal (1999).
// C. Four checks from Schilit, Perler and Engelhart, Financial Shenanigans, 4th ed. (2018), ch. 7, 8, 12 and 16.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const ITEMS = ["rev", "cogs", "sga", "ni", "cfo", "dep", "capex", "acq", "ar", "ada", "inv", "oca", "tca",
  "ppe", "ppen", "sec", "ta", "ap", "dr", "tcl", "ltd"];
export const SIGNED = ["ni", "cfo"];
export const DEFAULTS = { hi: 0.10 };

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const N = (v) => (has(v) ? v : 0);

// ── A. Montier's C-Score ──────────────────────────────────────────────────
export function cscore(y0, y1, hi) {
  const gap = (y) => (has(y.ni) && has(y.cfo) ? y.ni - y.cfo : null);
  const dso = (y) => (y.rev > 0 && has(y.ar) ? y.ar / y.rev * 365 : null);
  const dsi = (y) => (y.cogs > 0 && has(y.inv) ? y.inv / y.cogs * 365 : null);
  const oca = (y) => (y.rev > 0 && has(y.oca) ? y.oca / y.rev : null);
  const dep = (y) => (y.ppe > 0 && has(y.dep) ? y.dep / y.ppe : null);
  const rows = [
    { k: "gap", a: gap(y0), b: gap(y1), up: true },
    { k: "dso", a: dso(y0), b: dso(y1), up: true },
    { k: "dsi", a: dsi(y0), b: dsi(y1), up: true },
    { k: "oca", a: oca(y0), b: oca(y1), up: true },
    { k: "dep", a: dep(y0), b: dep(y1), up: false },
  ];
  rows.forEach((r) => { r.flag = r.a !== null && r.b !== null ? ((r.up ? r.b > r.a : r.b < r.a) ? 1 : 0) : null; });
  const growth = y0.ta > 0 && has(y1.ta) ? y1.ta / y0.ta - 1 : null;
  rows.push({ k: "ta", a: null, b: growth, flag: growth !== null ? (growth > hi ? 1 : 0) : null });
  const scored = rows.filter((r) => r.flag !== null).length;
  const up = rows.reduce((s, r) => s + (r.flag || 0), 0);
  const score = scored === 6 ? up : null;
  const band = score === null ? null : score >= 5 ? "high" : score >= 3 ? "middling" : "low";
  return { rows, scored, up, score, band };
}

// ── B. Beneish's M-Score ──────────────────────────────────────────────────
export const COEF = { dsri: 0.920, gmi: 0.528, aqi: 0.404, sgi: 0.892, depi: 0.115, sgai: -0.172, tata: 4.679, lvgi: -0.327 };
export const CONST = -4.84;
export function mscore(y0, y1) {
  const all = (...v) => v.every(has);
  const I = {};
  I.dsri = all(y0.ar, y1.ar) && y0.rev > 0 && y1.rev > 0 && y0.ar > 0 ? (y1.ar / y1.rev) / (y0.ar / y0.rev) : null;
  I.gmi = all(y0.cogs, y1.cogs) && y0.rev > 0 && y1.rev > 0 && y1.rev !== y1.cogs
    ? ((y0.rev - y0.cogs) / y0.rev) / ((y1.rev - y1.cogs) / y1.rev) : null;
  I.aqi = all(y0.tca, y1.tca, y0.ppen, y1.ppen) && y0.ta > 0 && y1.ta > 0 && (y0.tca + y0.ppen + N(y0.sec)) < y0.ta
    ? (1 - (y1.tca + y1.ppen + N(y1.sec)) / y1.ta) / (1 - (y0.tca + y0.ppen + N(y0.sec)) / y0.ta) : null;
  I.sgi = y0.rev > 0 && has(y1.rev) ? y1.rev / y0.rev : null;
  I.depi = all(y0.dep, y1.dep, y0.ppen, y1.ppen) && y1.dep > 0 && (y0.ppen + y0.dep) > 0
    ? (y0.dep / (y0.ppen + y0.dep)) / (y1.dep / (y1.ppen + y1.dep)) : null;
  I.sgai = all(y0.sga, y1.sga) && y0.rev > 0 && y1.rev > 0 && y0.sga > 0 ? (y1.sga / y1.rev) / (y0.sga / y0.rev) : null;
  I.tata = all(y1.ni, y1.cfo) && y1.ta > 0 ? (y1.ni - y1.cfo) / y1.ta : null;
  I.lvgi = all(y0.tcl, y1.tcl) && y0.ta > 0 && y1.ta > 0 && (y0.tcl + N(y0.ltd)) > 0
    ? ((y1.tcl + N(y1.ltd)) / y1.ta) / ((y0.tcl + N(y0.ltd)) / y0.ta) : null;
  const keys = Object.keys(COEF);
  const done = keys.filter((k) => I[k] !== null).length;
  const m = done === 8 ? keys.reduce((s, k) => s + COEF[k] * I[k], CONST) : null;
  const band = m === null ? null : m > -1.78 ? "above" : m > -2.22 ? "grey" : "below";
  return { idx: I, done, m, band };
}

// ── C. Schilit's checks ───────────────────────────────────────────────────
export function schilit(y0, y1) {
  const fcfa = (y) => (has(y.cfo) && has(y.capex) ? y.cfo - y.capex - N(y.acq) : null);
  const dpo = (y) => (y.cogs > 0 && has(y.ap) ? y.ap / y.cogs * 365 : null);
  const ada = (y) => (has(y.ada) && has(y.ar) && y.ar + N(y.ada) > 0 ? y.ada / (y.ar + y.ada) : null);
  const dr = (y) => (has(y.dr) ? y.dr : null);
  const rows = [
    { k: "fcfa", a: fcfa(y0), b: fcfa(y1) },
    { k: "dpo", a: dpo(y0), b: dpo(y1) },
    { k: "ada", a: ada(y0), b: ada(y1) },
    { k: "dr", a: dr(y0), b: dr(y1) },
  ];
  const both = (r) => r.a !== null && r.b !== null;
  rows[0].flag = rows[0].b !== null ? (y1.cfo > 0 && rows[0].b < 0 ? 1 : 0) : null;
  rows[1].flag = both(rows[1]) ? (rows[1].b > rows[1].a ? 1 : 0) : null;
  rows[2].flag = both(rows[2]) ? (rows[2].b < rows[2].a ? 1 : 0) : null;
  rows[3].flag = both(rows[3]) && y0.rev > 0 && has(y1.rev) ? (rows[3].b < rows[3].a && y1.rev > y0.rev ? 1 : 0) : null;
  const run = rows.filter((r) => r.flag !== null).length;
  const up = rows.reduce((s, r) => s + (r.flag || 0), 0);
  return { rows, run, up };
}

export function compute(y0, y1, hi = DEFAULTS.hi, mcap = 0) {
  const c = cscore(y0, y1, hi), b = mscore(y0, y1), s = schilit(y0, y1);
  const ps = mcap > 0 && y1.rev > 0 ? mcap / y1.rev : null;
  const short = c.score !== null && ps !== null ? c.score >= 5 && ps > 2 : null;
  return { c, b, s, ps, short };
}

export function check(raw) {
  const errors = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (const k of ITEMS.filter((x) => !SIGNED.includes(x))) for (const y of ["0", "1"]) {
    const v = raw[k + y]; if (has(v) && v < 0) errors.push([k + y, "Can't be negative."]);
  }
  for (const k of ["hi", "mcap"]) if (has(raw[k]) && raw[k] < 0) errors.push([k, "Can't be negative."]);
  return errors;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("rfform")) {
  const form = document.getElementById("rfform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const num = (v) => (v === null ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const days = (v) => (v === null ? "–" : v.toFixed(1) + " days");
  const minus = (t) => t.replace(/^-/, "−");
  const idx = (v) => (v === null ? "–" : minus(v.toFixed(3)));
  const FMT = { gap: num, dso: days, dsi: days, oca: (v) => (v === null ? "–" : pct(v, 2)), dep: (v) => (v === null ? "–" : pct(v, 2)),
    ta: (v) => (v === null ? "–" : pct(v, 1)), fcfa: num, dpo: days, ada: (v) => (v === null ? "–" : pct(v, 2)), dr: num };
  const C_NAMES = { gap: "net income is pulling away from cash flow", dso: "receivables are growing faster than sales", dsi: "inventory is piling up",
    oca: "other current assets are growing faster than sales", dep: "depreciation is falling against the asset base", ta: "total assets grew fast" };
  const S_NAMES = { fcfa: "cash flow turns negative after capex and acquisitions", dpo: "the company is paying suppliers later",
    ada: "the bad-debt allowance shrank against receivables", dr: "deferred revenue fell while sales grew" };
  const B_READ = { above: "above −1.78, where Beneish's manipulators sat", grey: "in the grey zone between −2.22 and −1.78", below: "below −2.22" };

  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const y = (s) => Object.fromEntries(ITEMS.map((k) => [k, has(raw[k + s]) ? raw[k + s] : null]));
    return { raw, y0: y("0"), y1: y("1"), hi: has(raw.hi) ? raw.hi / 100 : DEFAULTS.hi, mcap: has(raw.mcap) ? raw.mcap : 0 };
  }
  function showErrors(errors) {
    fields.forEach((f) => { f.removeAttribute("aria-invalid"); const e = (f.closest("td") || f.parentElement).querySelector(".err"); if (e) e.remove(); });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`); if (!f) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span"); e.className = "err"; e.textContent = msg;
      (f.closest("td") || f.parentElement).appendChild(e);
    });
  }
  function set(id, text, neg) { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); }
  function flagRows(prefix, rows) {
    rows.forEach((r) => {
      set(`${prefix}-${r.k}0`, r.k === "ta" ? "" : FMT[r.k](r.a));
      set(`${prefix}-${r.k}1`, FMT[r.k](r.b));
      set(`${prefix}-${r.k}f`, r.flag === null ? "–" : r.flag ? "Up" : "–", r.flag === 1);
      const tr = $(`${prefix}-${r.k}f`) && $(`${prefix}-${r.k}f`).closest("tr"); if (tr) tr.classList.toggle("on", r.flag === 1);
    });
  }

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, y0, y1, hi, mcap } = read();
    const errors = check(raw);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const { c, b, s, ps, short } = compute(y0, y1, hi, mcap);

    flagRows("c", c.rows);
    set("c-score", c.score === null ? (c.scored ? `${c.up} up of ${c.scored}` : "–") : `${c.score} / 6`, c.band === "high");
    set("c-read", c.score === null ? (c.scored ? "Incomplete" : "–") : { high: "High", middling: "Middling", low: "Low" }[c.band], c.band === "high");

    Object.keys(COEF).forEach((k) => {
      set(`b-${k}`, idx(b.idx[k]));
      set(`b-${k}w`, b.idx[k] === null ? "–" : minus((COEF[k] * b.idx[k]).toFixed(3)));
    });
    set("b-m", b.m === null ? (b.done ? `${b.done} of 8 indexes` : "–") : minus(b.m.toFixed(2)), b.band === "above");
    set("b-read", b.m === null ? "–" : { above: "Above −1.78", grey: "Grey zone", below: "Below −2.22" }[b.band], b.band === "above");

    flagRows("s", s.rows);
    set("s-up", s.run ? `${s.up} of ${s.run}` : "–", s.up > 0);

    set("o-ps", ps === null ? "–" : ps.toFixed(2) + "x");
    set("x-short", short === null ? "–" : short ? "Yes" : "No", short === true);

    if (!c.scored && !b.done && !s.run) { verdict.innerHTML = "<p>Fill in both years and the checks appear as you type.</p>"; bar.hidden = true; return; }
    const parts = [];
    if (c.score !== null) {
      const ups = c.rows.filter((r) => r.flag === 1).map((r) => C_NAMES[r.k]);
      parts.push(`<strong>C-Score ${c.score} of 6</strong>${ups.length ? ": " + ups.join("; ") : ""}.`);
    } else if (c.scored) parts.push(`<strong>C-Score</strong>: ${c.up} up of the ${c.scored} flags that can be scored so far.`);
    if (b.m !== null) parts.push(`<strong>M-Score ${minus(b.m.toFixed(2))}</strong>, ${B_READ[b.band]}.`);
    else if (b.done) parts.push(`<strong>M-Score</strong>: ${b.done} of the 8 indexes so far; it needs all of them.`);
    if (s.run) {
      const ups = s.rows.filter((r) => r.flag === 1).map((r) => S_NAMES[r.k]);
      parts.push(`<strong>Schilit, ${s.up} of ${s.run} up</strong>${ups.length ? ": " + ups.join("; ") : ""}.`);
    }
    if (short) parts.push("C-Score of 5 or more with price to sales above 2: the combination that lost money in Montier's test.");
    parts.push("Read the notes behind every flag that's up before drawing a conclusion.");
    const loud = (c.band === "high") + (b.band === "above") + (s.up >= 2);
    const tag = loud >= 2 ? ["Several red flags", " fail"] : loud === 1 ? ["Some red flags", " fail"] : ["Few red flags", ""];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${parts.join(" ")}</p>`;
    bar.hidden = false;
    const bits = [c.score !== null ? `C ${c.score}/6` : "", b.m !== null ? `M ${minus(b.m.toFixed(2))}` : "", s.run ? `S ${s.up}/${s.run}` : ""].filter(Boolean);
    bar.innerHTML = `<span>${bits.join(" · ") || tag[0]}</span><span>↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig && (c.score !== null || b.m !== null)) {
      const send = () => { lastSig = sig; track("calculate", { tool: "red-flags", result: bits.join(" "), source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    const co = $("f-co").value.trim(); if (co) v.co = co;
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", () => render("typing"));
  fields.forEach((f) => f.addEventListener("blur", () => render("blur")));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { $("stickybar").classList.toggle("away", e.isIntersecting); }).observe($("verdict"));
  }
  window.calcLink = () => shareUrl(values());
  $("share-link").addEventListener("click", () => {
    const url = shareUrl(values());
    try { history.replaceState(null, "", url); } catch (e) { /* sandboxed preview */ }
    copyText(url).then(() => {
      const bt = $("share-link"); bt.textContent = "Link copied";
      setTimeout(() => { bt.textContent = "Copy link to this calculation"; }, 2000);
    }).catch(() => {});
    track("share_calculation", { tool: "red-flags" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    $("f-co").value = "";
    form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });
    render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  const q = readQuery();
  if (q.co) $("f-co").value = q.co;
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  render(Object.keys(q).length ? "link" : "typing");
}
