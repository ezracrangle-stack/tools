// What stage is this company in? Same arithmetic as Life_Cycle_Template.xlsx.
// Mauboussin and Callahan, "Trading Stages in the Company Life Cycle" (Counterpoint Global), on Victoria Dickinson's method.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

export const STAGES = ["Introduction", "Growth", "Maturity", "Shake-out", "Decline"];
// Exhibits 5 (aggregate ROIC), 6 (median age), 7 (3-year sales growth), 8 (share of sample), 15 (median debt/total capital)
export const PROFILE = { Introduction: [-0.032, 6.4, 0.108, 0.065, 0.086], Growth: [0.094, 7.7, 0.099, 0.381, 0.129],
  Maturity: [0.115, 13.8, 0.054, 0.426, 0.14], "Shake-out": [0.047, 13.6, 0.036, 0.068, 0.203], Decline: [-0.094, 10.1, 0.041, 0.06, 0.119] };
// Exhibit 9: 3-year transition odds; Exhibit 12: annual 3-year TSR by path. Rows = start, columns = end (STAGES order).
export const TRANS = { Introduction: [0.26, 0.35, 0.15, 0.06, 0.18], Growth: [0.05, 0.44, 0.38, 0.07, 0.06], Maturity: [0.02, 0.25, 0.62, 0.08, 0.04],
  "Shake-out": [0.04, 0.24, 0.51, 0.13, 0.07], Decline: [0.12, 0.29, 0.31, 0.10, 0.18] };
export const TSR = { Introduction: [0.03, 0.19, 0.08, -0.06, -0.17], Growth: [-0.05, 0.14, 0.08, -0.04, -0.16], Maturity: [-0.03, 0.14, 0.12, 0.03, -0.05],
  "Shake-out": [0.04, 0.15, 0.13, 0.05, -0.03], Decline: [0.04, 0.20, 0.16, 0.05, -0.04] };

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const N = (v) => (has(v) ? v : 0);

export function stageOf(o, i, f) {
  const O = o >= 0, I = i >= 0, F = f >= 0;
  if (!O && !I && F) return "Introduction";
  if (O && !I && F) return "Growth";
  if (O && !I && !F) return "Maturity";
  if (!O && I) return "Decline";
  return "Shake-out";
}

// years: up to 5 objects {cfo, cfi, cff, sbc, intang, bought, sold}, oldest first. Cash flows signed as reported;
// sbc, intang, bought (purchases of marketable securities) and sold (sales and maturities) as positive numbers.
export function lifecycle(years) {
  const rows = years.map((y) => {
    if (!(has(y.cfo) && has(y.cfi) && has(y.cff))) return { op: null, inv: null, fin: null, signs: null, stage: null };
    const op = y.cfo - N(y.sbc) + N(y.intang), inv = y.cfi - N(y.intang) - (N(y.sold) - N(y.bought)), fin = y.cff + N(y.sbc);
    const s = (x) => (x >= 0 ? "+" : "-");
    return { op, inv, fin, signs: `${s(op)} ${s(inv)} ${s(fin)}`, stage: stageOf(op, inv, fin) };
  });
  const st = rows.map((r) => r.stage);
  const latest = [...st].reverse().find((s) => s) || null;
  const earlier = st[4] ? st[1] : st[3] ? st[0] : null;
  const j = latest ? STAGES.indexOf(latest) : -1;
  return {
    rows, latest, earlier, profile: latest ? PROFILE[latest] : null,
    odds: latest ? TRANS[latest] : null, tsrByEnd: latest ? TSR[latest] : null,
    pathTsr: latest && earlier ? TSR[earlier][j] : null,
  };
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("lcform")) {
  const form = document.getElementById("lcform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const num = (v) => (v === null ? "–" : (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const P = (v, d = 0) => (v === null ? "–" : (v < 0 ? "−" : "") + pct(Math.abs(v), d));
  const WHY = {
    Introduction: "it burns cash in operations, invests, and raises money to pay for both",
    Growth: "operations bring in cash, but it invests more than that and raises money for the rest",
    Maturity: "operations pay for the investment and what's left goes back to lenders and shareholders",
    "Shake-out": "the catch-all stage: its cash flows don't fit a cleaner pattern",
    Decline: "operations lose cash and it's selling assets",
  };
  const KEYS = ["cfo", "cfi", "cff", "sbc", "intang", "bought", "sold"];
  function set(id, text, neg) { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); }
  function read() {
    const raw = {};
    fields.forEach((f) => { if (!f.dataset.text) raw[f.dataset.k] = parseNumber(f.value); });
    const g = (k) => (has(raw[k]) ? raw[k] : null);
    return { raw, years: [0, 1, 2, 3, 4].map((i) => Object.fromEntries(KEYS.map((k) => [k, g(k + i)]))) };
  }
  function showErrors(errors) {
    fields.forEach((f) => { f.removeAttribute("aria-invalid"); const e = (f.closest("td") || f.parentElement).querySelector(".err"); if (e) e.remove(); });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`); if (!f) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span"); e.className = "err"; e.textContent = msg; (f.closest("td") || f.parentElement).appendChild(e);
    });
  }
  let lastSig = "", timer = null;
  function render(source) {
    const { raw, years } = read();
    const errors = Object.entries(raw).filter(([, v]) => Number.isNaN(v)).map(([k]) => [k, "Numbers only."]);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const r = lifecycle(years);
    r.rows.forEach((row, i) => {
      set(`a-op${i}`, num(row.op), row.op < 0); set(`a-inv${i}`, num(row.inv), row.inv < 0); set(`a-fin${i}`, num(row.fin), row.fin < 0);
      set(`a-sg${i}`, row.signs ? row.signs.replace(/-/g, "−") : "–"); set(`a-st${i}`, row.stage || "–");
    });
    set("o-latest", r.latest || "–"); set("o-earlier", r.earlier || "–");
    const pr = r.profile;
    set("o-roic", pr ? P(pr[0], 1) : "–", pr && pr[0] < 0); set("o-age", pr ? pr[1].toFixed(1) + " years" : "–");
    set("o-grow", pr ? P(pr[2], 1) : "–"); set("o-share", pr ? P(pr[3], 1) : "–"); set("o-debt", pr ? P(pr[4], 1) : "–");
    STAGES.forEach((s, j) => { set(`t-odds${j}`, r.odds ? P(r.odds[j]) : "–"); set(`t-tsr${j}`, r.tsrByEnd ? P(r.tsrByEnd[j]) : "–", r.tsrByEnd && r.tsrByEnd[j] < 0); });
    set("o-path", r.pathTsr === null ? "–" : P(r.pathTsr), r.pathTsr < 0);
    if (!r.latest) { verdict.innerHTML = "<p>Fill in the three cash flows for at least one year and the stage appears as you type.</p>"; bar.hidden = true; return; }
    const co = $("f-co").value.trim() || "The company";
    const last = [...r.rows].reverse().find((x) => x.stage);
    const j = STAGES.indexOf(r.latest);
    const stay = r.odds[j];
    const parts = [`<strong>${co} is in the ${r.latest.toLowerCase()} stage (${last.signs.replace(/-/g, "−")})</strong>: ${WHY[r.latest]}.`,
      `In the paper, companies in this stage earned an aggregate return on capital of ${P(pr[0], 1)} and grew sales ${P(pr[2], 1)} a year; ${P(stay)} were still there 3 years later.`];
    if (r.earlier) parts.push(r.earlier === r.latest
      ? `It was in the same stage 3 years earlier; companies that stayed there returned ${P(r.pathTsr)} a year.`
      : `Three years earlier it was in ${r.earlier.toLowerCase()}; companies that made that move returned ${P(r.pathTsr)} a year.`);
    verdict.innerHTML = `<p>${parts.join(" ")}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>Stage: ${r.latest}${r.earlier && r.earlier !== r.latest ? " (from " + r.earlier.toLowerCase() + ")" : ""}</span><span>↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "life-cycle", result: r.latest, source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }
  function values() {
    const v = {};
    const co = $("f-co").value.trim(); if (co) v.co = co;
    fields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.k] = f.dataset.text ? f.value.trim() : f.value.replace(/[\s,]/g, ""); });
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
    track("share_calculation", { tool: "life-cycle" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = ""; });
    $("f-co").value = "";
    form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });
    render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  const q = readQuery();
  if (q.co) $("f-co").value = q.co;
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  if (["sbc", "intang", "bought", "sold"].some((k) => [0, 1, 2, 3, 4].some((i) => q[k + i] !== undefined))) form.querySelector("details.helper").open = true;
  render(Object.keys(q).length ? "link" : "typing");
}
