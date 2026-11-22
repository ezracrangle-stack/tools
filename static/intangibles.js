// Intangibles and earnings: Mauboussin and Callahan, "Intangibles and Earnings" (Counterpoint Global, April 2022).
// Capitalize the investment part of SG&A and R&D and amortize it straight-line over its useful life (starting the year
// after the spend), assuming spending has grown at a steady rate. Same arithmetic as Intangibles_Template.xlsx.
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

// [industry, Main SG&A investment share, R&D investment share, Main SG&A life, R&D life]
// Iqbal, Rajgopal, Srivastava and Zhao (2022), as shown in the paper's Appendix A.
export const INDUSTRIES = [
  ["Precious Metals", 0.8, 0.85, 3.3, 6.9],
  ["Shipbuilding", 0.79, 0.31, 4.1, 1.7],
  ["Medical Equipment", 0.78, 0.88, 2.7, 6.1],
  ["Coal", 0.75, 0.2, 1.7, 5.5],
  ["Petroleum and Natural Gas", 0.73, 0.57, 3.6, 4.2],
  ["Food Products", 0.73, 0.61, 0.9, 4.1],
  ["Mining", 0.72, 0.96, 3.6, 6.9],
  ["Wholesale", 0.69, 0.8, 3.6, 4.0],
  ["Pharmaceutical Products", 0.68, 0.89, 4.2, 4.5],
  ["Automobiles and Trucks", 0.67, 0.82, 2.8, 5.7],
  ["Computers", 0.66, 0.8, 3.3, 4.4],
  ["Steel Works Etc.", 0.66, 0.82, 5.0, 3.2],
  ["Construction", 0.65, 0.64, 3.6, 5.8],
  ["Meals", 0.63, 0.89, 4.8, 5.3],
  ["Electronic Equipment", 0.59, 0.77, 2.8, 4.5],
  ["Communication", 0.59, 0.56, 2.9, 5.2],
  ["Machinery", 0.58, 0.81, 4.3, 3.7],
  ["Electrical Equipment", 0.56, 0.77, 2.0, 6.7],
  ["Business Services", 0.54, 0.62, 4.4, 6.7],
  ["Construction Materials", 0.53, 0.72, 3.9, 4.1],
  ["Rubber and Plastic Products", 0.52, 0.8, 1.4, 5.6],
  ["Fabricated Products", 0.52, 0.73, 0.3, 4.9],
  ["Measuring and Control Equipment", 0.51, 0.72, 2.4, 1.9],
  ["Candy & Soda", 0.49, 0.93, 4.2, 2.6],
  ["Apparel", 0.49, 0.64, 2.9, 4.5],
  ["Consumer Goods", 0.42, 0.91, 4.8, 6.4],
  ["Healthcare", 0.41, 0.85, 2.8, 2.9],
  ["Entertainment", 0.38, 0.89, 4.5, 6.0],
  ["Retail", 0.38, 0.91, 2.4, 3.9],
  ["Printing and Publishing", 0.38, 0.91, 4.0, 3.0],
  ["Textiles", 0.35, 0.45, 2.1, 4.1],
  ["Recreation", 0.34, 0.7, 4.3, 1.2],
  ["Chemicals", 0.32, 0.61, 3.0, 2.8],
  ["Agriculture", 0.31, 0.88, 4.5, 2.3],
  ["Aircraft", 0.29, 0.8, 4.8, 0.5],
  ["Personal Services", 0.23, 0.31, 2.4, 4.6],
  ["Tobacco Products", 0.18, 0.86, 4.3, 5.0],
  ["Defense", 0.12, 0.07, 4.1, 0.8],
  ["Business Supplies", 0.11, 0.83, 4.9, 4.9],
  ["Shipping Containers", 0.09, 0.88, 0.6, 1.3],
  ["Beer & Liquor", 0.09, 0.98, 1.5, 5.3],
  ["Transportation", 0.0, 0.96, 2.6, 3.5]
];
export const MAXL = 10;

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);

export function weights(L) {
  const w = Array(MAXL + 1).fill(0);
  if (!(L > 0)) return w;
  const f = Math.floor(L);
  for (let j = 1; j <= MAXL; j++) w[j] = j <= f ? 1 / L : j === f + 1 ? (L - f) / L : 0;
  return w;
}
// inv = this year's investment; returns amortization of past investment and the unamortized balance (year-end).
export function piece(inv, L, g) {
  const w = weights(L), d = [...Array(MAXL + 1)].map((_, j) => 1 / (1 + g) ** j);
  const amort = inv * w.reduce((s, x, j) => s + x * d[j], 0);
  let cum = 0, asset = 0;
  for (let k = 0; k < MAXL; k++) { cum += w[k]; asset += d[k] * Math.max(0, 1 - cum); }
  return { amort, asset: inv * asset };
}

export function industry(name) {
  const r = INDUSTRIES.find((x) => x[0] === name);
  return r ? { sMain: r[1], sRd: r[2], lMain: r[3], lRd: r[4] } : null;
}

// x: {rev, ebit, ni, sga, rd, g, tax, eq, mcap, sMain, sRd, lMain, lRd} (decimals; null if blank)
export function compute(x) {
  const g = has(x.g) ? x.g : 0, t = has(x.tax) ? x.tax : 0;
  const invMain = has(x.sga) && has(x.sMain) ? x.sga * x.sMain : 0;
  const invRd = has(x.rd) && has(x.sRd) ? x.rd * x.sRd : 0;
  const a = piece(invMain, x.lMain, g), b = piece(invRd, x.lRd, g);
  const inv = invMain + invRd, amort = a.amort + b.amort, delta = inv - amort, asset = a.asset + b.asset;
  const ok = x.rev > 0 && has(x.ebit);
  const ebitAdj = has(x.ebit) ? x.ebit + delta : null;
  const mBefore = ok ? x.ebit / x.rev : null, mAfter = ok ? ebitAdj / x.rev : null;
  const niAdj = has(x.ni) ? x.ni + delta * (1 - t) : null;
  const eqAdj = has(x.eq) ? x.eq + asset * (1 - t) : null;
  const mc = x.mcap > 0 ? x.mcap : null;
  const pe = (n) => (mc && n > 0 ? mc / n : null);
  const dm = ok ? mAfter - mBefore : null;
  return {
    invMain, invRd, inv, amortMain: a.amort, amortRd: b.amort, amort, deltaMain: invMain - a.amort, deltaRd: invRd - b.amort, delta,
    assetMain: a.asset, assetRd: b.asset, asset,
    ebitAdj, mBefore, mAfter, dm,
    niAdj, niChg: x.ni > 0 ? niAdj / x.ni - 1 : null,
    eqAdj, eqChg: x.eq > 0 ? eqAdj / x.eq - 1 : null,
    peBefore: pe(x.ni), peAfter: pe(niAdj), pbBefore: pe(x.eq), pbAfter: pe(eqAdj),
    band: dm === null ? null : Math.abs(dm) < 0.005 ? "barely" : Math.abs(dm) < 0.03 ? "moderate" : "large",
  };
}

export function check(raw) {
  const errors = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (const k of ["rev", "sga", "rd", "mcap", "tax", "smain", "srd", "lmain", "lrd"]) if (has(raw[k]) && raw[k] < 0) errors.push([k, "Can't be negative."]);
  for (const k of ["smain", "srd", "tax"]) if (has(raw[k]) && raw[k] > 100) errors.push([k, "100 at most."]);
  for (const k of ["lmain", "lrd"]) if (has(raw[k]) && raw[k] > MAXL) errors.push([k, `${MAXL} years at most.`]);
  if (has(raw.g) && raw.g <= -100) errors.push(["g", "Above −100."]);
  return errors;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("intform")) {
  const form = document.getElementById("intform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const sel = $("f-ind");
  sel.innerHTML = INDUSTRIES.map((r) => `<option>${r[0]}</option>`).join("");
  sel.value = sel.dataset.default;
  const num = (v) => (v === null ? "–" : (v < 0 ? "−" : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const P = (v, d = 1) => (v === null ? "–" : (v < 0 ? "−" : "") + pct(Math.abs(v), d));
  const PP = (v) => (v === null ? "–" : (v >= 0 ? "+" : "−") + (Math.abs(v) * 100).toFixed(1) + " pts");
  const CH = (v) => (v === null ? "–" : (v >= 0 ? "+" : "−") + pct(Math.abs(v), 1));
  const X = (v, d = 1) => (v === null ? "–" : v.toFixed(d) + "x");

  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const g = (k, div = 1) => (raw[k] !== null && raw[k] !== undefined && !Number.isNaN(raw[k]) ? raw[k] / div : null);
    const ind = industry(sel.value) || industry("Business Services");
    const x = { rev: g("rev"), ebit: g("ebit"), ni: g("ni"), sga: g("sga"), rd: g("rd"), g: g("g", 100), tax: g("tax", 100), eq: g("eq"), mcap: g("mcap"),
      sMain: g("smain", 100) ?? ind.sMain, sRd: g("srd", 100) ?? ind.sRd, lMain: g("lmain") ?? ind.lMain, lRd: g("lrd") ?? ind.lRd };
    return { raw, x, ind };
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
    const { raw, x, ind } = read();
    // the industry's figures as placeholders
    $("f-smain").placeholder = Math.round(ind.sMain * 100); $("f-srd").placeholder = Math.round(ind.sRd * 100);
    $("f-lmain").placeholder = ind.lMain.toFixed(1); $("f-lrd").placeholder = ind.lRd.toFixed(1);
    set("t-smain", pct(ind.sMain, 0)); set("t-srd", pct(ind.sRd, 0)); set("t-lmain", ind.lMain.toFixed(1)); set("t-lrd", ind.lRd.toFixed(1));
    const errors = check(raw);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const r = compute(x);
    const ready = x.rev > 0 && (x.sga !== null || x.rd !== null);
    set("o-invm", num(r.invMain)); set("o-invr", num(r.invRd)); set("o-inv", num(r.inv));
    set("o-amm", num(r.amortMain)); set("o-amr", num(r.amortRd)); set("o-am", num(r.amort));
    set("o-dm", num(r.deltaMain), r.deltaMain < 0); set("o-dr", num(r.deltaRd), r.deltaRd < 0); set("o-d", num(r.delta), r.delta < 0);
    set("o-asm", num(r.assetMain)); set("o-asr", num(r.assetRd)); set("o-as", num(r.asset));
    set("b-ebit", x.ebit === null ? "–" : num(x.ebit), x.ebit < 0); set("a-ebit", num(r.ebitAdj), r.ebitAdj < 0);
    set("b-m", P(r.mBefore), r.mBefore < 0); set("a-m", P(r.mAfter), r.mAfter < 0); set("c-m", PP(r.dm));
    set("b-ni", x.ni === null ? "–" : num(x.ni), x.ni < 0); set("a-ni", num(r.niAdj), r.niAdj < 0); set("c-ni", CH(r.niChg));
    set("b-eq", x.eq === null ? "–" : num(x.eq), x.eq < 0); set("a-eq", num(r.eqAdj), r.eqAdj < 0); set("c-eq", CH(r.eqChg));
    set("b-pe", X(r.peBefore)); set("a-pe", X(r.peAfter)); set("b-pb", X(r.pbBefore, 2)); set("a-pb", X(r.pbAfter, 2));
    set("x-read", r.band ? { barely: "Barely moves", moderate: "Moderate change", large: "Large change" }[r.band] : "–");

    if (!ready || r.band === null) { verdict.innerHTML = "<p>Fill in revenue, operating income and SG&amp;A (and R&amp;D if there is any), and the results appear as you type.</p>"; bar.hidden = true; return; }
    const co = $("f-co").value.trim() || "The company";
    const parts = [];
    parts.push(`<strong>${co} invested about ${num(r.inv)} this year through SG&amp;A and R&amp;D</strong> (${pct(r.inv / x.rev, 1)} of revenue), money the income statement counts as an expense.`);
    if (Math.abs(r.delta) < 1e-9) parts.push("With no growth in that spending, this year's investment equals the amortization of past years, so earnings don't change.");
    else parts.push(`Treating it as an investment ${r.delta > 0 ? "adds" : "takes away"} ${num(Math.abs(r.delta))} of operating income: the operating margin goes from ${P(r.mBefore)} to ${P(r.mAfter)} (${PP(r.dm)}).`);
    if (r.peBefore !== null && r.peAfter !== null) parts.push(`The P/E goes from ${X(r.peBefore)} to ${X(r.peAfter)}.`);
    parts.push(`About ${num(r.asset)} of intangible capital isn't on the balance sheet.`);
    parts.push("Free cash flow doesn't change: only the line between expense and investment moves.");
    const tag = { barely: ["Barely moves", ""], moderate: ["Moderate change", ""], large: ["Large change", " fail"] }[r.band];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${parts.join(" ")}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>Margin ${P(r.mBefore)} → ${P(r.mAfter)}</span><span>↓</span>`;
    const sig = JSON.stringify(raw) + sel.value;
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "intangibles", result: PP(r.dm), source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    const co = $("f-co").value.trim(); if (co) v.co = co;
    if (sel.value !== sel.dataset.default) v.ind = sel.value;
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", () => render("typing"));
  sel.addEventListener("change", () => render("typing"));
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
    track("share_calculation", { tool: "intangibles" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    $("f-co").value = ""; sel.value = sel.dataset.default;
    form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });
    render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  const q = readQuery();
  if (q.co) $("f-co").value = q.co;
  if (q.ind && INDUSTRIES.some((r) => r[0] === q.ind)) sel.value = q.ind;
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  render(Object.keys(q).length ? "link" : "typing");
}
