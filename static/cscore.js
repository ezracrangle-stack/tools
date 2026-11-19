// Montier's C-Score: Value Investing (2009), chapter 25. Same arithmetic as CScore_Template.xlsx.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const ITEMS = ["rev", "cogs", "ni", "cfo", "ar", "inv", "oca", "dep", "ppe", "ta"];
export const DEFAULTS = { hi: 0.10 };

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);

// y0 = prior year, y1 = latest year: objects with the ITEMS keys (null when blank).
export function compute(y0, y1, hi, mcap) {
  const gap = (y) => (has(y.ni) && has(y.cfo) ? y.ni - y.cfo : null);                         // row 19
  const dso = (y) => (y.rev > 0 && has(y.ar) ? y.ar / y.rev * 365 : null);                     // row 20
  const dsi = (y) => (y.cogs > 0 && has(y.inv) ? y.inv / y.cogs * 365 : null);                 // row 21
  const oca = (y) => (y.rev > 0 && has(y.oca) ? y.oca / y.rev : null);                         // row 22
  const dep = (y) => (y.ppe > 0 && has(y.dep) ? y.dep / y.ppe : null);                         // row 23
  const rows = [
    { k: "gap", a: gap(y0), b: gap(y1), up: true },
    { k: "dso", a: dso(y0), b: dso(y1), up: true },
    { k: "dsi", a: dsi(y0), b: dsi(y1), up: true },
    { k: "oca", a: oca(y0), b: oca(y1), up: true },
    { k: "dep", a: dep(y0), b: dep(y1), up: false },
  ];
  rows.forEach((r) => { r.flag = r.a !== null && r.b !== null ? ((r.up ? r.b > r.a : r.b < r.a) ? 1 : 0) : null; });
  const growth = y0.ta > 0 && has(y1.ta) ? y1.ta / y0.ta - 1 : null;                           // D24
  rows.push({ k: "ta", a: null, b: growth, flag: growth !== null ? (growth > hi ? 1 : 0) : null }); // E24
  const scored = rows.filter((r) => r.flag !== null).length;                                   // C28
  const up = rows.reduce((s, r) => s + (r.flag || 0), 0);
  const score = scored === 6 ? up : null;                                                      // C29
  const ps = mcap > 0 && y1.rev > 0 ? mcap / y1.rev : null;                                    // C33
  const short = score !== null && ps !== null ? score >= 5 && ps > 2 : null;                   // C34
  const band = score === null ? null : score >= 5 ? "high" : score >= 3 ? "middling" : "low";  // C30
  return { rows, scored, up, score, band, ps, short };
}

export function check(raw) {
  const errors = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (const k of ["rev", "cogs", "ar", "inv", "oca", "dep", "ppe", "ta"]) for (const y of ["0", "1"]) {
    const v = raw[k + y]; if (has(v) && v < 0) errors.push([k + y, "Can't be negative."]);
  }
  if (has(raw.hi) && raw.hi < 0) errors.push(["hi", "Can't be negative."]);
  if (has(raw.mcap) && raw.mcap < 0) errors.push(["mcap", "Can't be negative."]);
  return errors;
}

export const READ = {
  high: (s) => `High: ${s} of 6 flags. The kind of score that underperformed in Montier's test.`,
  middling: (s) => `Middling: ${s} of 6 flags. Look at the ones that are up.`,
  low: (s) => `Low: ${s} of 6 flags. Little sign of the usual tricks.`,
};

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("csform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const num = (v) => (v === null ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const FMT = { gap: num, dso: (v) => (v === null ? "–" : v.toFixed(1) + " days"), dsi: (v) => (v === null ? "–" : v.toFixed(1) + " days"),
    oca: (v) => (v === null ? "–" : pct(v, 2)), dep: (v) => (v === null ? "–" : pct(v, 2)), ta: (v) => (v === null ? "–" : pct(v, 1)) };
  const NAMES = { gap: "net income is pulling away from cash flow", dso: "receivables are growing faster than sales", dsi: "inventory is piling up",
    oca: "other current assets are growing faster than sales", dep: "depreciation is falling against the asset base", ta: "total assets grew fast" };

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

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, y0, y1, hi, mcap } = read();
    const errors = check(raw);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar"), warn = $("warnings");
    warn.hidden = true;
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const res = compute(y0, y1, hi, mcap);
    res.rows.forEach((r) => {
      set(`c-${r.k}0`, r.k === "ta" ? "" : FMT[r.k](r.a));
      set(`c-${r.k}1`, FMT[r.k](r.b));
      set(`c-${r.k}f`, r.flag === null ? "–" : r.flag ? "Up" : "–", r.flag === 1);
      const tr = $(`c-${r.k}f`) && $(`c-${r.k}f`).closest("tr"); if (tr) tr.classList.toggle("on", r.flag === 1);
    });
    set("o-scored", `${res.scored} of 6`);
    set("o-score", res.score === null ? (res.scored ? `${res.up} up of ${res.scored}` : "–") : `${res.score} / 6`, res.band === "high");
    set("x-read", res.score === null ? (res.scored ? "Incomplete" : "–") : { high: "High", middling: "Middling", low: "Low" }[res.band], res.band === "high");
    set("o-ps", res.ps === null ? "–" : res.ps.toFixed(2) + "x");
    set("x-short", res.short === null ? "–" : res.short ? "Yes: Montier's short candidate" : "No", res.short === true);
    if (res.scored === 0) { verdict.innerHTML = "<p>Fill in both years and the flags appear as you type.</p>"; bar.hidden = true; return; }
    const ups = res.rows.filter((r) => r.flag === 1).map((r) => NAMES[r.k]);
    let s;
    if (res.score === null) s = `${res.up} flag${res.up === 1 ? "" : "s"} up out of the ${res.scored} that can be scored so far. Fill in both years for every line to get the full score.`;
    else s = READ[res.band](res.score) + " " + (ups.length ? `Flags up: ${ups.join("; ")}.` : "None of the six flags is up.");
    if (res.short) s += " With price to sales above 2, this is the combination that lost money in Montier's test.";
    s += " The C-Score is a first step: read the notes behind every flag that's up.";
    const tag = res.score === null ? [`${res.up} of ${res.scored}`, ""] : [`C-Score ${res.score}`, res.band === "high" ? " fail" : ""];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${s}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>${tag[0]}</span><span>${res.ps === null ? "" : "P/S " + res.ps.toFixed(1) + " "}↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig && res.score !== null) {
      const send = () => { lastSig = sig; track("calculate", { tool: "cscore", result: String(res.score), source }); };
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
      const b = $("share-link"); b.textContent = "Link copied";
      setTimeout(() => { b.textContent = "Copy link to this calculation"; }, 2000);
    }).catch(() => {});
    track("share_calculation", { tool: "cscore" });
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
