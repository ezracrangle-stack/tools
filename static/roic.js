// ROIC, ROIIC and reinvestment rate. Same formulas as ROIC_Reinvestment_Template.xlsx (rows noted).
// ROIC and reinvestment: Ezra's Quality Investing guide and Damodaran. ROIIC lag and goodwill view: Mauboussin & Callahan (2022).
import { parseNumber, amount, pct, multiple, track, shareUrl, readQuery, copyText } from "./calc.js";

export const LINES = ["rev", "ebit", "am", "capex", "acq", "da", "dwc", "debt", "mi", "eq", "cash", "gw"];
const T = [0, 1, 2, 3, 4, 5, 6];
const num = (v) => typeof v === "number" && isFinite(v);

// x[line] = array of 7 values (Year 0..6, null = blank); x.tax = array or single rate; x.opc, x.coc fractions.
export function compute(x) {
  const g = (k, t) => (x[k] && x[k][t]) || 0;
  const tax = (t) => (Array.isArray(x.tax) ? x.tax[t] || 0 : x.tax || 0);
  const nopat = T.map((t) => (t === 0 ? null : (g("ebit", t) + g("am", t)) * (1 - tax(t))));          // row 19
  const reinv = T.map((t) => (t === 0 ? null : g("capex", t) + g("acq", t) - g("da", t) + g("dwc", t))); // row 24
  const ic = T.map((t) => g("debt", t) + g("mi", t) + g("eq", t) - Math.max(0, g("cash", t) - x.opc * g("rev", t))); // row 34
  const icx = T.map((t) => ic[t] - g("gw", t));                                                         // row 36
  const per = (f, from = 1) => T.map((t) => (t < from ? null : f(t)));
  const roic = per((t) => (ic[t - 1] > 0 ? nopat[t] / ic[t - 1] : null));                              // row 40
  const roicx = per((t) => (icx[t - 1] > 0 ? nopat[t] / icx[t - 1] : null));                           // row 41
  const margin = per((t) => (g("rev", t) > 0 ? nopat[t] / g("rev", t) : null));                         // row 42
  const turn = per((t) => (ic[t - 1] > 0 ? g("rev", t) / ic[t - 1] : null));                           // row 43
  const spread = per((t) => (x.coc > 0 && roic[t] !== null ? roic[t] - x.coc : null));                 // row 44
  const roiic1 = per((t) => (ic[t - 1] - ic[t - 2] > 0 ? (nopat[t] - nopat[t - 1]) / (ic[t - 1] - ic[t - 2]) : null), 2); // row 45
  const rr = per((t) => (nopat[t] > 0 ? reinv[t] / nopat[t] : null));                                  // row 49
  const bsr = per((t) => ic[t] - ic[t - 1]);                                                           // row 50
  const bsrr = per((t) => (nopat[t] > 0 ? bsr[t] / nopat[t] : null));                                  // row 51
  const fg = per((t) => (rr[t] !== null && roic[t] !== null ? rr[t] * roic[t] : null));                // row 52
  const ng = per((t) => (nopat[t - 1] > 0 ? nopat[t] / nopat[t - 1] - 1 : null), 2);                   // row 53

  const last5 = [2, 3, 4, 5, 6];
  const sum = (a) => last5.reduce((s, t) => s + (a[t] || 0), 0);
  const r5 = last5.map((t) => roic[t]).filter(num);
  const avgRoic = r5.length ? r5.reduce((a, b) => a + b, 0) / r5.length : null;                       // C58
  const roiic3 = ic[5] - ic[2] > 0 ? (nopat[6] - nopat[3]) / (ic[5] - ic[2]) : null;                   // C59
  const roiic5 = ic[5] - ic[0] > 0 ? (nopat[6] - nopat[1]) / (ic[5] - ic[0]) : null;                   // C60
  const rr5 = sum(nopat) > 0 ? sum(reinv) / sum(nopat) : null;                                         // C62
  const fg5 = rr5 !== null && avgRoic !== null ? rr5 * avgRoic : null;                                 // C64
  const cagr = nopat[1] > 0 && nopat[6] > 0 ? Math.pow(nopat[6] / nopat[1], 1 / 5) - 1 : null;         // C65
  const gap = fg5 !== null && cagr !== null ? fg5 - cagr : null;                                      // C66
  const bsVsCf = sum(reinv) !== 0 ? sum(bsr) / sum(reinv) : null;                                      // C67
  return { nopat, reinv, ic, icx, roic, roicx, margin, turn, spread, roiic1, rr, bsr, bsrr, fg, ng,
    roicL: roic[6], roicxL: roicx[6], avgRoic, roiic3, roiic5, rrL: rr[6], rr5, fgL: fg[6], fg5, cagr, gap, bsVsCf };
}

export function check(x, raw) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
    else if (v !== null && v < 0 && !/^(ebit|dwc|eq)\d$/.test(k)) errors.push([k, "Can't be negative."]);
  }
  const need = ["tax", "ebit6", "eq5", "eq6"];
  for (const k of need) if (raw[k] === null) errors.push([k, "Needed for the calculation."]);
  if (raw.tax !== null && raw.tax >= 100) errors.push(["tax", "Below 100."]);
  return { errors, warnings };
}

export function warningsFor(x, r) {
  const w = [];
  if (r.bsVsCf !== null && (r.bsVsCf < 0.5 || r.bsVsCf > 1.5)) w.push(`Invested capital grew ${multiple(r.bsVsCf)} what the cash flow statement says was reinvested. Look for impairments, currency moves, buybacks paid with cash, or a line in the wrong place.`);
  if (r.roicL !== null && r.roicxL !== null && r.roicxL > 2 * r.roicL) w.push("ROIC without goodwill is more than twice the figure with it. The business is excellent; the acquisitions earned much less.");
  if (r.rr5 !== null && r.rr5 > 1) w.push("Over five years the company reinvested more than it earned, so it needed debt, new shares or its cash to fund it.");
  if (r.roiic3 !== null && r.roiic5 !== null && Math.abs(r.roiic3 - r.roiic5) > 0.25) w.push("The 3- and 5-year ROIIC are far apart. One big investment or a bad year moves it a lot, so read them together.");
  if (r.roicL !== null && r.roicL > 0.5) w.push("ROIC above 50% often comes partly from a small capital base, because R&D and marketing are expensed. Mauboussin's adjusted ROIC capitalizes them.");
  return w;
}

export function interpret(r) {
  if (r.roicL === null) return "Fill in the latest year to see the returns.";
  let s = `The business earned ${pct(r.roicL, 1)} on its capital last year`;
  if (r.avgRoic !== null) s += ` and ${pct(r.avgRoic, 1)} on average over five years`;
  s += ".";
  if (r.roiic5 !== null) s += ` New capital earned ${pct(r.roiic5, 1)} over five years (ROIIC), ${r.roiic5 >= (r.avgRoic ?? 0) ? "at or above" : "below"} the average.`;
  if (r.rr5 !== null && r.fg5 !== null) s += ` It reinvested ${pct(r.rr5)} of what it earned, which supports about ${pct(r.fg5, 1)} growth a year${r.cagr !== null ? `; NOPAT actually grew ${pct(r.cagr, 1)}` : ""}.`;
  return s;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("roicform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const settings = ["cur", "u"];
  const ok = (v) => v !== null && !Number.isNaN(v);
  const fmtInput = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });

  function read() {
    const raw = {}, x = {};
    const u = Number($("u").value);
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    LINES.forEach((k) => { x[k] = T.map((t) => (ok(raw[k + t]) ? raw[k + t] * u : null)); });
    x.tax = ok(raw.tax) ? raw.tax / 100 : 0;
    x.opc = ok(raw.opc) ? raw.opc / 100 : 0.02;
    x.coc = ok(raw.coc) ? raw.coc / 100 : null;
    return { raw, x, u, cur: $("cur").value };
  }
  function showErrors(errors, quiet) {
    fields.forEach((f) => { f.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".err").forEach((e) => e.remove());
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`);
      if (!f || f.getAttribute("aria-invalid")) return;
      if (quiet && f.value.trim() === "" && msg.startsWith("Needed")) return;
      f.setAttribute("aria-invalid", "true");
      if (!f.closest(".grid")) { const e = document.createElement("span"); e.className = "err"; e.textContent = msg; f.insertAdjacentElement("afterend", e); }
    });
  }
  const set = (id, text, neg) => { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); };
  function labels() {
    const y = parseNumber($("f-year").value);
    T.forEach((t) => form.querySelectorAll(`.yl${t}`).forEach((el) => { el.textContent = ok(y) && y > 1900 ? String(y - 6 + t) : `Year ${t}`; }));
  }

  let lastSig = "", timer = null;
  function render(source) {
    labels();
    const { raw, x, u, cur } = read();
    const { errors } = check(x, raw);
    showErrors(errors, source === "typing");
    const verdict = $("verdict"), warn = $("warnings"), bar = $("stickybar");
    if (errors.length) {
      form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });
      warn.hidden = true; bar.hidden = true;
      verdict.innerHTML = `<p>${errors.some(([, m]) => m.startsWith("Needed")) ? "Fill in at least the latest year's EBIT and the last two years of equity. The more years you add, the more the multi-year figures mean." : "Fix the fields marked above."}</p>`;
      return;
    }
    const r = compute(x);
    const has = (t) => raw["ebit" + t] !== null;
    const p = (v, d = 1) => (v === null ? "n/m" : pct(v, d));
    T.forEach((t) => {
      if (t === 0) return;
      const show = has(t);
      set(`r-nopat${t}`, show ? amount(r.nopat[t], u) : "–", r.nopat[t] < 0);
      set(`r-reinv${t}`, show ? amount(r.reinv[t], u) : "–", r.reinv[t] < 0);
      ["roic", "roicx", "margin", "rr", "bsrr", "fg"].forEach((k) => set(`r-${k}${t}`, show ? p(r[k][t]) : "–", r[k][t] !== null && r[k][t] < 0));
      set(`r-turn${t}`, show && r.turn[t] !== null ? multiple(r.turn[t]) : "–");
      if (t >= 2) {
        set(`r-roiic1${t}`, show && has(t - 1) ? p(r.roiic1[t]) : "–", r.roiic1[t] !== null && r.roiic1[t] < 0);
        set(`r-ng${t}`, show && has(t - 1) ? p(r.ng[t]) : "–", r.ng[t] !== null && r.ng[t] < 0);
      }
    });
    T.forEach((t) => set(`r-ic${t}`, raw["eq" + t] !== null ? amount(r.ic[t], u) : "–"));
    const full = [1, 2, 3, 4, 5, 6].every(has) && T.every((t) => raw["eq" + t] !== null);
    const s3 = [3, 6].every(has) && [2, 5].every((t) => raw["eq" + t] !== null);
    set("o-roicL", p(r.roicL), r.roicL < 0); set("o-roicxL", p(r.roicxL), r.roicxL < 0);
    set("o-spread", x.coc !== null && r.roicL !== null ? p(r.roicL - x.coc) : "–");
    set("o-avgRoic", full ? p(r.avgRoic) : "–");
    set("o-roiic3", s3 ? p(r.roiic3) : "–"); set("o-roiic5", full ? p(r.roiic5) : "–");
    set("o-rrL", p(r.rrL, 0)); set("o-rr5", full ? p(r.rr5, 0) : "–");
    set("o-fgL", p(r.fgL)); set("o-fg5", full ? p(r.fg5) : "–"); set("o-cagr", full ? p(r.cagr) : "–");
    set("o-gap", full && r.gap !== null ? (r.gap >= 0 ? "+" : "") + (100 * r.gap).toFixed(1) + " pts" : "–");
    set("o-bsVsCf", full && r.bsVsCf !== null ? multiple(r.bsVsCf) : "–");
    const ws = full ? warningsFor(x, r) : [];
    warn.hidden = !ws.length;
    warn.innerHTML = ws.length ? `<p class="kicker">Worth a second look</p>` + ws.map((w) => `<p>${w}</p>`).join("") : "";
    const rr = full ? r : { ...r, avgRoic: null, roiic5: null, rr5: null, fg5: null, cagr: null };
    const lvl = r.roicL === null ? null : r.roicL >= 0.15 ? ["High returns", ""] : r.roicL >= 0.08 ? ["Middling returns", ""] : ["Low returns", " fail"];
    verdict.innerHTML = `${lvl ? `<span class="tag${lvl[1]}">ROIC ${pct(r.roicL, 1)}</span>` : ""}<p>${interpret(rr)}</p>`;
    bar.hidden = r.roicL === null;
    bar.innerHTML = `<span>ROIC ${p(r.roicL)}${full && r.roiic5 !== null ? " · ROIIC " + p(r.roiic5) : ""}</span><span>Results ↓</span>`;
    const sig = JSON.stringify([raw, $("u").value]);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "roic", result: lvl ? lvl[0] : "partial", source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }
  function values() {
    const v = {}; settings.forEach((k) => { v[k] = $(k).value; });
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", () => render("typing"));
  settings.forEach((k) => $(k).addEventListener("change", () => render("typing")));
  fields.forEach((f) => f.addEventListener("blur", () => { const v = parseNumber(f.value); if (ok(v) && Math.abs(v) >= 1000 && f.dataset.k !== "year") f.value = fmtInput(v); render("blur"); }));
  // Paste a row of numbers (e.g. from a spreadsheet) into the first cell of a line and spread it across the years.
  form.querySelectorAll(".grid input[data-k]").forEach((f) => f.addEventListener("paste", (ev) => {
    const text = (ev.clipboardData || window.clipboardData).getData("text");
    const parts = text.trim().split(/\t|;|\s{2,}/).filter((s) => s !== "");
    if (parts.length < 2) return;
    ev.preventDefault();
    const line = f.dataset.k.replace(/\d$/, ""); let t = Number(f.dataset.k.slice(-1));
    parts.forEach((s) => { const el = form.querySelector(`input[data-k="${line}${t}"]`); if (el) el.value = s.trim(); t++; });
    render("typing");
  }));
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { $("stickybar").classList.toggle("away", e.isIntersecting); }).observe($("verdict"));
  $("share-link").addEventListener("click", () => {
    const url = shareUrl(values());
    try { history.replaceState(null, "", url); } catch (e) { /* preview */ }
    copyText(url).then(() => { const b = $("share-link"); b.textContent = "Link copied"; setTimeout(() => { b.textContent = "Copy link to this calculation"; }, 2000); }).catch(() => {});
    track("share_calculation", { tool: "roic" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; }); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  const q = readQuery();
  settings.forEach((k) => { if (q[k] && [...$(k).options].some((o) => o.value === q[k])) $(k).value = q[k]; });
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  render(Object.keys(q).length ? "link" : "typing");
}
