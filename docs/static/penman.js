// Residual operating income, Stephen Penman's method (Accounting for Value, ch. 2-6).
// One-year version of Penman_Residual_Income_Template.xlsx; the cell of each line is noted.
import { parseNumber, perShare, amount, pct, track,
  shareUrl, readQuery, copyText } from "./calc.js";

export const DEFAULTS = { r: 0.09, gdp: 0.04 };
export const KEY_FIELDS = ["sh", "p", "noa", "nfo", "oi"];

// Amounts and shares in the same unit; rates as fractions; eq and bond are null when blank.
export function compute(x) {
  const pnoa = x.sh * x.p + x.nfo + x.mi;                              // C25
  const ebp = pnoa > 0 ? x.noa / pnoa : 0;                              // C26
  const chk = x.eq === null ? null : x.noa - x.nfo - x.mi - x.eq;       // C22
  const rnoa = x.noa > 0 ? x.oi / x.noa : 0;                            // C53
  const ri = x.oi - x.r * x.noa;                                        // C54
  const vops = x.r > 0 ? x.noa + ri / x.r : 0;                          // C58
  const val = x.sh > 0 ? (vops - x.nfo - x.mi) / x.sh : 0;              // C62
  const mos = val > 0 ? 1 - x.p / val : 0;                              // C63
  const b1 = x.sh > 0 ? (x.noa - x.nfo - x.mi) / x.sh : 0;              // C67
  const b2 = x.sh > 0 ? (vops - x.noa) / x.sh : 0;                      // C68
  const b3 = x.p - b1 - b2;                                             // C69
  const g = ri > 0 && pnoa - x.noa > 0 ? x.r - ri / (pnoa - x.noa) : null; // C73
  const irnoa = x.noa > 0 ? x.r + (pnoa - x.noa) * x.r / x.noa : 0;     // C75
  const ngr = pnoa > 0 ? x.oi / pnoa : 0;                               // C87
  const wg = 1 - ebp;                                                   // C88
  const rgdp = ngr + wg * x.gdp;                                        // C89
  const gneed = wg > 0 ? (x.r - ngr) / wg : null;                       // C90
  const vsb = x.bond === null ? null : ngr - x.bond;                    // C91
  const profile = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7].map((n) => ngr + wg * n / 100); // C94:C104
  return { pnoa, ebp, chk, rnoa, ri, vops, val, mos, b1, b2, b3, g, irnoa, ngr, wg, rgdp, gneed, vsb, profile };
}

// Helper A: the reformulated balance sheet (Helper A in the template, C149-C176).
export function helperBS(oa, ol, fa, fo, mi) {
  const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
  const noa = sum(oa) - sum(ol), nfo = sum(fo) - sum(fa);
  return { oa: sum(oa), ol: sum(ol), fa: sum(fa), fo: sum(fo), noa, nfo, mi: mi || 0 };
}
// Helper B: next year's operating income at the latest after-tax margin (C51 = revenue × (1 + growth) × PM).
export function helperOI(rev, ebit, tax, growth) {
  const margin = rev > 0 ? ebit * (1 - tax) / rev : 0;
  return { margin, oi: rev * (1 + growth) * margin };
}

export function check(x, res, raw, signed) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
    else if (v !== null && v < 0 && !signed.has(k)) errors.push([k, "Can't be negative."]);
  }
  for (const k of KEY_FIELDS) if (raw[k] === null) errors.push([k, "Needed for the calculation."]);
  if (raw.sh === 0) errors.push(["sh", "Shares can't be zero."]);
  if (raw.p === 0) errors.push(["p", "Price can't be zero."]);
  if (raw.noa !== null && raw.noa <= 0) errors.push(["noa", "Has to be above zero. With no operating assets there's nothing to anchor on."]);
  if (raw.r === 0) errors.push(["r", "The hurdle can't be zero."]);
  if (errors.length || !res) return { errors, warnings };

  if (res.chk !== null && Math.abs(res.chk) > 0.001 * Math.abs(x.eq) + 1e-9) warnings.push("NOA − net financial obligations − minority interest doesn't equal the book equity. Something is counted twice or missing; find it before you trust the rest.");
  if (res.ri <= 0) warnings.push(`The operations earn ${pct(res.rnoa, 1)} on their book value, below your ${pct(x.r)} hurdle. Take it as a finding: the business is worth less than its NOA unless profitability improves.`);
  if (res.pnoa <= x.noa) warnings.push("The market values the operations below their book value, so the growth and return figures don't mean much. Check the balance sheet, then the business.");
  if (res.rnoa > 0.5) warnings.push("RNOA above 50% usually means conservative accounting (R&D, brands and other investments expensed) or a small NOA. Penman's warning: a high RNOA isn't proof of a moat.");
  if (res.vsb !== null && res.vsb < 0) warnings.push("The no-growth return is below the company's own bond yield. You'd earn less owning the shares than the bonds if growth doesn't come.");
  if (x.r > 0.15) warnings.push("A hurdle above 15% is very high for a listed company. Check that it's what you really want to earn.");
  const big = Math.max(x.noa, Math.abs(res.pnoa));
  if (big > 0 && (x.sh * x.p / big > 50 || x.sh * x.p / big < 0.02)) warnings.push("Market cap and NOA are more than 50 times apart. That usually means the units for amounts or shares are off.");
  return { errors, warnings };
}

export function interpret(x, res, cur) {
  const ps = (v) => perShare(v, cur, x.p);
  if (res.ri <= 0) {
    return `The operations earn ${pct(res.rnoa, 1)} on their book value, below your ${pct(x.r)} hurdle, so with no growth they're worth ${ps(res.val)} a share. ` +
      (res.pnoa > x.noa ? `At ${ps(x.p)} the market expects profitability to recover: the price implies an RNOA of ${pct(res.irnoa, 1)}.` : `At ${ps(x.p)} the market values the operations below their book value.`);
  }
  if (res.g === null) return `At ${ps(x.p)} you pay less than the no-growth value of ${ps(res.val)}. The market pays nothing for growth, and you'd earn ${pct(res.ngr, 1)} a year if growth never comes.`;
  const vs = res.g > x.gdp ? `above the ${pct(x.gdp, 1)} GDP benchmark` : `at or below the ${pct(x.gdp, 1)} GDP benchmark`;
  return `At ${ps(x.p)} the price implies residual income growth of ${pct(res.g, 1)} a year, ${vs}. That's also the growth you need to earn your ${pct(x.r)} hurdle. If growth never comes, you earn ${pct(res.ngr, 1)} a year; at GDP growth, ${pct(res.rgdp, 1)}.`;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("pnform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const signed = new Set(fields.filter((f) => f.dataset.signed).map((f) => f.dataset.k));
  const settings = ["cur", "u", "su"];
  const fmtInput = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  const ok = (v) => v !== null && !Number.isNaN(v);

  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const u = Number($("u").value), su = Number($("su").value);
    const x = {};
    fields.forEach((f) => {
      const k = f.dataset.k, kind = f.dataset.kind, v = ok(raw[k]) ? raw[k] : 0;
      x[k] = kind === "money" ? v * u : kind === "shares" ? v * su : kind === "percent" ? v / 100 : v;
    });
    for (const [k, d] of Object.entries(DEFAULTS)) if (raw[k] === null) x[k] = d;
    x.eq = ok(raw.eq) ? raw.eq * u : null;
    x.bond = ok(raw.bond) ? raw.bond / 100 : null;
    return { raw, x, u, cur: $("cur").value };
  }

  function showErrors(errors, quiet) {
    fields.forEach((f) => {
      f.removeAttribute("aria-invalid");
      const e = f.parentElement.querySelector(".err");
      if (e) e.remove();
    });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`);
      if (!f || f.getAttribute("aria-invalid")) return;
      if (quiet && f.value.trim() === "" && msg.startsWith("Needed")) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span");
      e.className = "err"; e.textContent = msg;
      f.insertAdjacentElement("afterend", e);
    });
  }
  function set(id, text, neg) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("neg", !!neg);
  }
  const clearAll = () => form.querySelectorAll("output").forEach((o) => {
    if (o.closest(".helper")) return;
    o.textContent = "–"; o.classList.remove("neg");
  });

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x, u, cur } = read();
    const pre = check(x, null, raw, signed);
    showErrors(pre.errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");
    if (pre.errors.length) {
      clearAll(); warn.hidden = true; bar.hidden = true;
      const missing = pre.errors.some(([, m]) => m.startsWith("Needed"));
      verdict.innerHTML = `<p>${missing ? "Fill in the fields marked * and the results appear as you type." : "Fix the fields marked above."}</p>`;
      return;
    }
    const res = compute(x);
    const { warnings } = check(x, res, raw, signed);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";

    const ps = (v) => perShare(v, cur, x.p);
    const share = (v) => `${ps(v)} · ${pct(x.p > 0 ? v / x.p : 0)}`;
    set("x-chk", res.chk === null ? "Add the equity" : Math.abs(res.chk) <= 0.001 * Math.abs(x.eq) + 1e-9 ? "OK" : `Off by ${amount(res.chk, u)}`);
    set("o-pnoa", amount(res.pnoa, u), res.pnoa < 0);
    set("o-ebp", res.pnoa > 0 ? res.ebp.toFixed(3) : "n/m");
    set("o-rnoa", pct(res.rnoa, 1), res.rnoa < 0);
    set("o-ri", amount(res.ri, u), res.ri < 0);
    set("o-val", ps(res.val), res.val < 0);
    set("o-mos", res.val > 0 ? pct(res.mos) : "n/m", res.mos < 0);
    set("o-b1", share(res.b1), res.b1 < 0);
    set("o-b2", share(res.b2), res.b2 < 0);
    set("o-b3", share(res.b3), res.b3 < 0);
    set("o-g", res.g === null ? "n/m" : pct(res.g, 2), res.g !== null && res.g < 0);
    set("o-gvs", res.g === null ? "n/m" : (res.g - x.gdp >= 0 ? "+" : "") + (100 * (res.g - x.gdp)).toFixed(2) + " pts");
    set("o-irnoa", pct(res.irnoa, 1));
    set("o-ngr", pct(res.ngr, 2), res.ngr < 0);
    set("o-rgdp", pct(res.rgdp, 2));
    set("o-vsb", res.vsb === null ? "–" : (res.vsb >= 0 ? "+" : "") + (100 * res.vsb).toFixed(2) + " pts", res.vsb !== null && res.vsb < 0);
    res.profile.forEach((v, i) => {
      set("pf" + i, pct(v, 2), v < 0);
      const d = $("pd" + i); if (d) d.textContent = (v - x.r >= 0 ? "+" : "") + (100 * (v - x.r)).toFixed(2) + " pts";
      const row = $("pr" + i); if (row) row.classList.toggle("hit", v >= x.r);
    });

    const tag = res.ri <= 0 ? ["Earns below your hurdle", " fail"] : res.g === null ? ["Priced below no growth", ""]
      : res.g > x.gdp ? ["Priced for growth above GDP", " fail"] : ["Priced for GDP growth or less", ""];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, res, cur)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>${res.g === null ? "No-growth " + ps(res.val) : "Implied growth " + pct(res.g, 1)}</span><span>Return ${pct(res.ngr, 1)} ↓</span>`;

    const sig = JSON.stringify([raw, $("u").value, $("su").value]);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "penman", result: tag[0], source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  // ── Helpers ──
  const hfields = [...form.querySelectorAll("input[data-h]")];
  const hv = (k) => { const el = form.querySelector(`input[data-h="${k}"]`); const v = el ? parseNumber(el.value) : null; return ok(v) ? v : null; };
  const fmtH = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  const writeField = (k, v) => { const f = $("f-" + k); const s = Math.round(v * 1000) / 1000; f.value = Math.abs(s) >= 1000 ? fmtInput(s) : String(s); };
  function runHelpers(changed) {
    const n = (p, c) => Array.from({ length: c }, (_, i) => hv(p + (i + 1)));
    const A = helperBS(n("oa", 9), n("ol", 5), n("fa", 2), n("fo", 6), hv("hmi"));
    const anyA = hfields.some((f) => f.dataset.h.match(/^(oa|ol|fa|fo|hmi)/) && f.value.trim() !== "");
    ["oa", "ol", "fa", "fo", "noa", "nfo"].forEach((k) => { $("h-" + k).textContent = anyA ? fmtH(A[k]) : "–"; });
    if (changed === "A" && anyA) { writeField("noa", A.noa); writeField("nfo", A.nfo); writeField("mi", A.mi); }
    const rev = hv("hrev"), ebit = hv("hebit");
    if (rev !== null && ebit !== null && rev > 0) {
      const tax = (hv("htax") ?? 25) / 100, gr = (hv("hgr") ?? 0) / 100;
      const B = helperOI(rev, ebit, tax, gr);
      $("h-margin").textContent = pct(B.margin, 1); $("h-oi").textContent = fmtH(B.oi);
      if (changed === "B") writeField("oi", B.oi);
    } else { $("h-margin").textContent = "–"; $("h-oi").textContent = "–"; }
  }
  hfields.forEach((f) => {
    const group = /^(oa|ol|fa|fo|hmi)/.test(f.dataset.h) ? "A" : "B";
    f.addEventListener("input", (ev) => { ev.stopPropagation(); runHelpers(group); render("typing"); });
    f.addEventListener("blur", () => { const v = parseNumber(f.value); if (ok(v) && Math.abs(v) >= 1000) f.value = fmtInput(v); });
  });

  function values() {
    const v = {};
    settings.forEach((k) => { v[k] = $(k).value; });
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    hfields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.h] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (ev) => { if (ev.target.dataset && ev.target.dataset.h) return; render("typing"); });
  settings.forEach((k) => $(k).addEventListener("change", () => render("typing")));
  fields.forEach((f) => f.addEventListener("blur", () => {
    const v = parseNumber(f.value);
    if (ok(v) && Math.abs(v) >= 1000) f.value = fmtInput(v);
    render("blur");
  }));
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
    track("share_calculation", { tool: "penman" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    hfields.forEach((f) => { f.value = ""; });
    showErrors([]); clearAll(); runHelpers(); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });

  const q = readQuery();
  if (Object.keys(q).length) {
    settings.forEach((k) => { if (q[k] && [...$(k).options].some((o) => o.value === q[k])) $(k).value = q[k]; });
    fields.forEach((f) => {
      if (q[f.dataset.k] === undefined) return;
      const v = parseNumber(q[f.dataset.k]);
      f.value = ok(v) && Math.abs(v) >= 1000 ? fmtInput(v) : q[f.dataset.k];
    });
    hfields.forEach((f) => { if (q[f.dataset.h] !== undefined) { f.value = q[f.dataset.h]; f.closest("details").open = true; } });
    runHelpers(); render("link");
  } else { runHelpers(); render("typing"); }
}
