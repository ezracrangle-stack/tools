// What discount rate should you use? WACC calculator. Same arithmetic as WACC_Template.xlsx.
// Mauboussin and Callahan, "Cost of Capital: A Practical Guide to Measuring Opportunity Cost" (Counterpoint Global, 2023).
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const N = (v) => (has(v) ? v : 0);

// Rates as decimals. adjust = pull the company beta toward 1.0 (0.67 x beta + 0.33). ubeta = unlevered industry beta (optional).
export function wacc({ rf, erp, beta, adjust = true, ubeta, kd, tax, equity, debt, own }) {
  const tot = N(equity) + N(debt);
  const wd = tot > 0 ? N(debt) / tot : null, we = wd === null ? null : 1 - wd;
  const de = equity > 0 ? N(debt) / equity : null;
  const relevered = has(ubeta) ? ubeta * (1 + (1 - N(tax)) * N(de)) : null;
  const b = relevered !== null ? relevered : has(beta) ? (adjust ? beta * 0.67 + 0.33 : beta) : null;
  const ke = has(rf) && has(erp) && b !== null ? rf + b * erp : null;
  const kdAfter = has(kd) ? kd * (1 - N(tax)) : null;
  const w = ke !== null && wd !== null && (N(debt) === 0 || kdAfter !== null) ? we * ke + wd * N(kdAfter) : null;
  const check = ke !== null && kdAfter !== null ? ke > kdAfter : null;
  const grid = [-0.01, 0, 0.01].map((d) => [-0.2, 0, 0.2].map((db) => (w === null ? null : we * (rf + (b + db) * (erp + d)) + wd * N(kdAfter))));
  return {
    relevered, beta: b, ke, kdAfter, wd, we, de, wacc: w, check, grid,
    ownVsWacc: has(own) && w !== null ? own - w : null, ownVsRf: has(own) && has(rf) ? own - rf : null,
  };
}

export function check(raw) {
  const errors = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (const k of ["equity", "debt"]) if (has(raw[k]) && raw[k] < 0) errors.push([k, "Can't be negative."]);
  if (has(raw.tax) && (raw.tax < 0 || raw.tax >= 100)) errors.push(["tax", "Between 0 and 100."]);
  return errors;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("waform")) {
  const form = document.getElementById("waform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const adj = $("f-adj");
  const P = (v) => (v === null ? "–" : (v < 0 ? "−" : "") + pct(Math.abs(v), 2));
  const SP = (v) => (v === null ? "–" : (v >= 0 ? "+" : "−") + (Math.abs(v) * 100).toFixed(2) + " pts");
  const B = (v) => (v === null ? "–" : v.toFixed(2));
  function set(id, text, neg) { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); }
  function showErrors(errors) {
    fields.forEach((f) => { f.removeAttribute("aria-invalid"); const e = f.parentElement.querySelector(".err"); if (e) e.remove(); });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`); if (!f) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span"); e.className = "err"; e.textContent = msg; f.parentElement.appendChild(e);
    });
  }
  const RATES = ["rf", "erp", "kd", "tax", "own"];
  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const g = (k) => (has(raw[k]) ? (RATES.includes(k) ? raw[k] / 100 : raw[k]) : null);
    return { raw, i: { rf: g("rf"), erp: g("erp"), beta: g("beta"), adjust: adj.checked, ubeta: g("ubeta"), kd: g("kd"), tax: g("tax"), equity: g("equity"), debt: g("debt"), own: g("own") } };
  }
  let lastSig = "", timer = null;
  function render(source) {
    const { raw, i } = read();
    const errors = check(raw);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const r = wacc(i);
    set("o-relev", B(r.relevered)); set("o-beta", B(r.beta)); set("o-ke", P(r.ke)); set("o-kd", P(r.kdAfter));
    set("o-wd", P(r.wd)); set("o-we", P(r.we)); set("o-de", B(r.de)); set("o-wacc", P(r.wacc));
    set("o-check", r.check === null ? "–" : r.check ? "OK" : "Recheck", r.check === false);
    r.grid.forEach((row, a) => row.forEach((x, b) => set(`g${a}${b}`, P(x))));
    set("o-ownw", SP(r.ownVsWacc), r.ownVsWacc < 0); set("o-ownrf", SP(r.ownVsRf), r.ownVsRf < 0);
    const parts = [];
    const co = $("f-co").value.trim() || "The company";
    if (r.wacc !== null) {
      parts.push(`<strong>${co}'s WACC is about ${pct(r.wacc, 1)}</strong>: a ${pct(r.ke, 1)} cost of equity on ${pct(r.we, 0)} of the capital${r.wd > 0 ? ` and a ${pct(r.kdAfter, 1)} after-tax cost of debt on the other ${pct(r.wd, 0)}` : ""}.`);
      parts.push(`With the beta 0.2 lower or higher and the equity risk premium a point lower or higher, it ranges from ${pct(r.grid[0][0], 1)} to ${pct(r.grid[2][2], 1)}. The Russell 3000 averaged 7.9% from 1985 to 2022.`);
      if (r.check === false) parts.push("<strong>The cost of equity came out below the cost of debt.</strong> The paper says that should never happen: recheck the beta or the cost of debt.");
    } else if (r.ke !== null) parts.push(`<strong>Cost of equity: ${pct(r.ke, 1)}.</strong> Add the capital structure to get the WACC.`);
    if (r.ownVsWacc !== null) parts.push(`Your own rate is ${(Math.abs(r.ownVsWacc) * 100).toFixed(1)} points ${r.ownVsWacc >= 0 ? "above" : "below"} the WACC${r.ownVsRf !== null ? ` and ${(Math.abs(r.ownVsRf) * 100).toFixed(1)} points ${r.ownVsRf >= 0 ? "above" : "below"} the risk-free rate` : ""}.`);
    else if (r.ownVsRf !== null) parts.push(`Your own rate asks for ${(Math.abs(r.ownVsRf) * 100).toFixed(1)} points ${r.ownVsRf >= 0 ? "more" : "less"} than the risk-free rate.`);
    if (!parts.length) { verdict.innerHTML = "<p>Fill in the fields and the results appear as you type.</p>"; bar.hidden = true; return; }
    verdict.innerHTML = `<p>${parts.join(" ")}</p>`;
    bar.hidden = false;
    const bits = [r.wacc !== null ? "WACC " + pct(r.wacc, 1) : r.ke !== null ? "Cost of equity " + pct(r.ke, 1) : "", has(i.own) ? "Your rate " + pct(i.own, 1) : ""].filter(Boolean);
    bar.innerHTML = `<span>${bits.join(" · ")}</span><span>↓</span>`;
    const sig = JSON.stringify(raw) + adj.checked;
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "wacc", result: bits.join(" "), source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }
  function values() {
    const v = {};
    const co = $("f-co").value.trim(); if (co) v.co = co;
    fields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.k] = f.value.replace(/[\s,%]/g, ""); });
    if (!adj.checked) v.adj = "0";
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", () => render("typing"));
  adj.addEventListener("change", () => render("blur"));
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
    track("share_calculation", { tool: "wacc" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = ""; });
    $("f-co").value = ""; adj.checked = true;
    form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });
    render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  const q = readQuery();
  if (q.co) $("f-co").value = q.co;
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  if (q.adj === "0") adj.checked = false;
  if (q.ubeta !== undefined) form.querySelector("details.helper").open = true;
  render(Object.keys(q).length ? "link" : "typing");
}
