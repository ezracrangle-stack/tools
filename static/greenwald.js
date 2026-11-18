// Assets vs earnings power, Bruce Greenwald's method (Value Investing: From Graham to Buffett
// and Beyond, ch. 4-6, and his Columbia lectures). Same formulas as Parts 1-3 of
// Greenwald_EPV_Template.xlsx; the cell of each line is noted.
import { parseNumber, perShare, amount, multiple, pct, track,
  shareUrl, readQuery, copyText } from "./calc.js";

// Percent inputs are typed as whole numbers (9 = 9%) and arrive here as fractions.
export const DEFAULTS = { ry: 3, ke: 0.09, cap: 0.30, opc: 0.005 };
export const ASSETS = ["cash", "ar", "inv", "oca", "ppe", "gw", "oi", "ooa"];          // rows 15-22
export const LIQ = { cash: 1, ar: 0.85, inv: 0.5, oca: 0.5, ppe: 0.45, gw: 0, oi: 0, ooa: 0.5 }; // E15:E22
export const KEY_FIELDS = ["sh", "p", "rev", "mg", "tax", "da", "mcx"];

// Money and shares arrive in the same unit (the ratio is all that matters for per-share figures).
// x[k] = book value; x["r"+k] = reproduction cost or null (= book); x["l"+k] = liquidation fraction or null (= Greenwald's).
// x.via: "y" (industry viable: reproduction) or "n" (liquidation). x.xtax: null = half the tax rate.
export function compute(x) {
  const v = (k) => x[k] || 0;
  let totBook = 0, totRep = 0, totLiq = 0;
  for (const k of ASSETS) {
    const book = v(k);
    const rep = k === "gw" ? 0 : x["r" + k] === null || x["r" + k] === undefined ? book : x["r" + k]; // D15:D22
    const lf = x["l" + k] === null || x["l" + k] === undefined ? LIQ[k] : x["l" + k];
    totBook += book; totRep += rep; totLiq += book * lf;                                                 // F15:F22
  }
  const ry = x.ry === null || x.ry === undefined ? DEFAULTS.ry : x.ry;
  const prod = v("rd") * ry;                                         // D23
  const cust = v("ib") * v("im");                                    // D24
  totRep += prod + cust;                                             // C25, D25, F25
  const avBook = totBook - v("sl") - v("dtl");                       // C28
  const avRep = totRep - v("sl") - v("dtl");                         // D28
  const avLiq = totLiq - v("sl") - v("dtl");                         // F28
  const avUsed = x.via === "n" ? avLiq : avRep;                      // C29

  const sebit = v("rev") * v("mg");                                  // C41
  const aebit = sebit - v("roo") + v("gsp") + v("oadj");             // C45
  const nopat = aebit * (1 - v("tax"));                              // C47
  const xd = v("da") - v("mcx");                                     // C50
  const xt = x.xtax === null || x.xtax === undefined ? v("tax") / 2 : x.xtax; // C51
  const axd = xd * (1 - xt);                                         // C52
  const ep = nopat + axd;                                            // C53

  const mcap = v("sh") * v("p");                                     // C10
  const dw = v("debt") + mcap > 0 ? v("debt") / (v("debt") + mcap) : 0; // C59
  const w = Math.min(dw, x.cap);
  const wacc = w * v("kd") * (1 - v("tax")) + (1 - w) * x.ke;        // C61
  const R = Math.round(Number((wacc * 100).toPrecision(12))) / 100;  // C62, like Excel's ROUND
  const epvE = R > 0 ? ep / R : 0;                                   // C63
  const surplus = Math.max(0, v("cash") - v("rev") * x.opc);         // C65
  const claims = v("debt") + v("leg") + v("pref") + v("mi");
  const epvEq = epvE + surplus + v("noa") - claims;                  // C70
  const epvps = v("sh") > 0 ? epvEq / v("sh") : 0;                   // C71
  const mos = epvps > 0 ? 1 - v("p") / epvps : 0;                    // C72
  const mev = mcap + claims - surplus - v("noa");                    // C73
  const emos = epvE > 0 ? 1 - mev / epvE : 0;                        // C74

  const avOp = avUsed - surplus;                                     // C77
  const ratio = avOp > 0 ? epvE / avOp : 0;                          // C78
  const kase = avOp <= 0 ? "–" : ratio < 0.75 ? "A" : ratio <= 1.25 ? "B" : "C"; // C79
  const franchise = epvE - avOp;                                     // C81
  const avEq = avUsed + v("noa") - claims;                           // C82
  const avps = v("sh") > 0 ? avEq / v("sh") : 0;                     // C83
  const roc = avOp > 0 ? ep / avOp : 0;                              // C84
  const dpv = v("dp") * v("rev");                                    // memo: intangibles at deal prices

  return { totBook, totRep, totLiq, avBook, avRep, avLiq, avUsed, prod, cust, sebit, aebit, nopat, xd, xt, axd, ep,
    mcap, dw, wacc, R, epvE, surplus, epvEq, epvps, mos, mev, emos, avOp, ratio, case: kase, franchise, avEq, avps, roc, dpv };
}

// ── Helpers (Helper A and B in the Excel template) ───────────────────────
const mean = (xs) => { const v = xs.filter((n) => n !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };

// Helper A: plain mean of the yearly margins (C125); average EBIT as a memo (C124).
export function helperMargin(ebits, revenues) {
  const margins = ebits.map((e, i) => (e !== null && revenues[i] !== null && revenues[i] > 0 ? e / revenues[i] : null));
  return { margins, margin: mean(margins), n: margins.filter((m) => m !== null).length, ebit: mean(ebits) };
}

// Helper B: maintenance capex = total capex − growth capex; growth capex = intensity × revenue increase (C130-C136).
export function helperCapex(ppe, rev, ownIntensity, capex, drev) {
  const intensity = ownIntensity !== null ? ownIntensity : rev > 0 ? ppe / rev : 0;
  const growth = capex.map((c, i) => (c === null ? null : Math.max(0, drev[i] || 0) * intensity));
  const maint = capex.map((c, i) => (c === null ? null : c - growth[i]));
  return { intensity, growth, maint, mcx: mean(maint), n: maint.filter((m) => m !== null).length };
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
  if (raw.ke === 0) errors.push(["ke", "The cost of equity can't be zero."]);
  for (const k of ["tax", "xtax", "cap"]) if (raw[k] !== null && raw[k] >= 100) errors.push([k, "Below 100."]);
  if (errors.length || !res) return { errors, warnings };

  if (res.ep <= 0) warnings.push("Earnings power is zero or negative, so there's no EPV to set against the assets. Either the business loses money at a normal margin, or one of the inputs is off.");
  if (x.mcx < 0.5 * x.da) warnings.push("Maintenance capex is less than half of D&A. Possible, but it's the line that moves the EPV most, so check it with the helper.");
  if (res.dw > x.cap) warnings.push(`Debt is ${pct(res.dw)} of capital, above the ${pct(x.cap)} cap, so the rate counts only ${pct(x.cap)} as debt. With this much debt, the margin of safety on the whole business is the one to read.`);
  if (x.via === "y" && res.case === "C" && res.prod + res.cust === 0) warnings.push("Case C with no intangibles in section 1. Before you call it a franchise, add what a rival would spend on products, brands and customers. Without them the asset value is too low and the gap looks bigger than it is.");
  if (x.via === "n" && res.prod + res.cust > 0) warnings.push("With No in the first question, the R&D and brand lines don't count: a liquidator gets nothing for them.");
  if (x.ke > 0.15) warnings.push("A cost of equity above 15% is more than venture capital funds aim to make. Greenwald treats that as the ceiling.");
  if (x.tax > 0 && x.tax < 0.10) warnings.push("A tax rate under 10% is unusual. Use the average of several years, or the statutory rate if this year was a one-off.");
  if (x.dp > 0 && x.rev > 0 && res.cust > 0 && (res.cust / res.dpv > 2 || res.cust / res.dpv < 0.5)) warnings.push("Your value for customers and brands is more than double, or less than half, what deals for similar businesses imply. One of the two is off.");
  const big = Math.max(Math.abs(res.epvE), Math.abs(res.avUsed));
  if (big > 0 && (res.mcap / big > 50 || res.mcap / big < 0.02)) warnings.push("Market cap and EPV are more than 50 times apart. That usually means the units for amounts or shares are off.");
  return { errors, warnings };
}

export function interpret(x, res, cur) {
  const ps = (v) => perShare(v, cur, x.p);
  const vsPrice = res.epvps > 0
    ? (x.p <= res.epvps ? `At ${ps(x.p)} the share trades ${pct(res.mos)} below its EPV of ${ps(res.epvps)} a share.`
      : `At ${ps(x.p)} the share trades ${pct(x.p / res.epvps - 1)} above its EPV of ${ps(res.epvps)} a share.`)
    : "The EPV per share is zero or negative after debt and other claims.";
  if (res.ep <= 0) return "Earnings power is zero or negative, so there's nothing to compare with the assets. The business is worth its assets at best, and only if someone can use them better.";
  if (res.case === "–") return `${vsPrice} Fill in section 1 to compare it with what the assets would cost.`;
  const m = multiple(res.ratio);
  if (x.via === "n") {
    if (res.case === "A") return `EPV is ${m} the liquidation value. The business is worth more sold off than running, so the value comes from a sale or a change at the top. ${vsPrice}`;
    if (res.case === "B") return `EPV is ${m} the liquidation value. The business earns about what its assets would fetch in a sale. ${vsPrice}`;
    return `EPV is ${m} the liquidation value, so keeping the business running is worth more than selling it off. For the moat question, answer Yes at the top and compare with what the assets would cost to rebuild. ${vsPrice}`;
  }
  if (res.case === "A") return `EPV is ${m} the asset value: case A. The business earns less than its assets would cost to rebuild, so management or the industry is wasting capital, and growth would waste more. ${vsPrice}`;
  if (res.case === "B") return `EPV and asset value are within 25% of each other (${m}): case B. That's what an industry with free entry looks like, with no franchise, so growth adds nothing. ${vsPrice}`;
  return `EPV is ${m} the asset value: case C. The business earns well above what its assets cost, which only a real competitive advantage explains. Name it before you trust the number. Growth can add value here, and this calculator leaves it out. ${vsPrice}`;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("avform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const via = $("f-via");
  const signed = new Set(fields.filter((f) => f.dataset.signed).map((f) => f.dataset.k));
  const settings = ["cur", "u", "su"];
  const fmtInput = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  const ok = (v) => v !== null && !Number.isNaN(v);

  function read() {
    const raw = {};
    fields.forEach((f) => { raw[f.dataset.k] = parseNumber(f.value); });
    const u = Number($("u").value), su = Number($("su").value);
    const x = { via: via.value };
    fields.forEach((f) => {
      const k = f.dataset.k, kind = f.dataset.kind, v = ok(raw[k]) ? raw[k] : 0;
      x[k] = kind === "money" ? v * u : kind === "shares" ? v * su : kind === "percent" ? v / 100 : v;
    });
    for (const [k, d] of Object.entries(DEFAULTS)) if (raw[k] === null) x[k] = d;
    for (const k of ASSETS) {
      x["r" + k] = ok(raw["r" + k]) ? raw["r" + k] * u : null;
      x["l" + k] = ok(raw["l" + k]) ? raw["l" + k] / 100 : null;
    }
    x.xtax = ok(raw.xtax) ? raw.xtax / 100 : null;
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

  // The second column of section 1 switches between reproduction cost and liquidation %.
  function applyMode() {
    const liq = via.value === "n";
    form.classList.toggle("mode-liq", liq);
    $("colhead-mode").textContent = liq ? "Recovered %" : "Reproduction";
    form.querySelectorAll(".intang").forEach((el) => el.classList.toggle("off", liq));
  }

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x, u, cur } = read();
    const pre = check(x, null, raw, signed);
    showErrors(pre.errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");
    const partial = compute(x);
    const showAssets = () => {
      set("o-prod", amount(partial.prod, u)); set("o-cust", amount(partial.cust, u));
      set("o-dpv", raw.dp === null || raw.rev === null ? "–" : amount(partial.dpv, u));
      set("o-tot", amount(x.via === "n" ? partial.totLiq : partial.totRep, u));
      set("o-av", amount(partial.avUsed, u), partial.avUsed < 0);
    };
    if (pre.errors.length) {
      clearAll(); showAssets();
      warn.hidden = true; bar.hidden = true;
      const missing = pre.errors.some(([, m]) => m.startsWith("Needed"));
      verdict.innerHTML = `<p>${missing ? "Fill in the fields marked * and the results appear as you type." : "Fix the fields marked above."}</p>`;
      return;
    }
    const res = compute(x);
    const { warnings } = check(x, res, raw, signed);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";

    const ps = (v) => perShare(v, cur, x.p);
    showAssets();
    set("o-sebit", amount(res.sebit, u), res.sebit < 0);
    set("o-aebit", amount(res.aebit, u), res.aebit < 0);
    set("o-nopat", amount(res.nopat, u), res.nopat < 0);
    set("o-xd", amount(res.xd, u), res.xd < 0);
    set("o-axd", amount(res.axd, u), res.axd < 0);
    set("o-ep", amount(res.ep, u), res.ep < 0);
    set("o-dw", pct(res.dw, 1));
    set("o-wacc", pct(res.wacc, 2));
    set("o-R", pct(res.R));
    set("o-epvE", amount(res.epvE, u), res.epvE < 0);
    set("o-surplus", amount(res.surplus, u));
    set("o-epvEq", amount(res.epvEq, u), res.epvEq < 0);
    set("o-epvps", ps(res.epvps), res.epvps < 0);
    set("o-mos", res.epvps > 0 ? pct(res.mos) : "n/m", res.mos < 0);
    set("o-emos", res.epvE > 0 ? pct(res.emos) : "n/m", res.emos < 0);
    const haveAV = res.avOp > 0;
    set("o-avOp", amount(res.avOp, u), res.avOp < 0);
    set("o-ratio", haveAV ? multiple(res.ratio) : "n/m");
    set("x-case", res.case === "–" ? "n/m" : "Case " + res.case);
    set("o-franchise", haveAV ? amount(res.franchise, u) : "n/m", res.franchise < 0);
    set("o-roc", haveAV ? pct(res.roc, 1) : "n/m", res.roc < 0);
    set("o-avEq", amount(res.avEq, u), res.avEq < 0);
    set("o-avps", ps(res.avps), res.avps < 0);

    const tag = res.ep <= 0 ? ["No earnings power", " fail"] : res.case === "–" ? ["EPV only", " fail"]
      : x.via === "n" ? (res.case === "A" ? ["Case A: worth more sold", " fail"] : res.case === "B" ? ["Case B: about even", " fail"] : ["Case C: worth more running", ""])
      : res.case === "A" ? ["Case A: value destroyed", " fail"] : res.case === "B" ? ["Case B: no franchise", " fail"] : ["Case C: franchise", ""];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, res, cur)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>${res.case === "–" ? "EPV " + ps(res.epvps) : "EPV " + multiple(res.ratio) + " assets"}</span><span>${tag[0].split(":")[0]} ↓</span>`;

    const sig = JSON.stringify([raw, via.value, $("u").value, $("su").value]);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "greenwald", result: res.case, source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  // ── Helpers ──
  const hfields = [...form.querySelectorAll("input[data-h]")];
  const hv = (k) => { const el = form.querySelector(`input[data-h="${k}"]`); const v = el ? parseNumber(el.value) : null; return ok(v) ? v : null; };
  const fmtH = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
  const writeField = (k, shown) => {
    const f = $("f-" + k);
    f.value = Math.abs(shown) >= 1000 ? fmtInput(shown) : String(shown);
  };
  function runHelpers(changed) {
    const N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const A = helperMargin(N.map((i) => hv("he" + i)), N.map((i) => hv("hr" + i)));
    A.margins.forEach((m, i) => { $("hm" + (i + 1)).textContent = m === null ? "" : pct(m, 1); });
    $("h-margin").textContent = A.n ? `${pct(A.margin, 2)} (${A.n} year${A.n > 1 ? "s" : ""})` : "–";
    if (changed === "A" && A.n) writeField("mg", Math.round(A.margin * 1e6) / 1e4);

    const B = helperCapex(hv("hppe") || 0, hv("hrev") || 0, hv("hci"), [1, 2, 3].map((i) => hv("hc" + i)), [1, 2, 3].map((i) => hv("hd" + i)));
    $("h-int").textContent = B.intensity > 0 ? B.intensity.toFixed(3) : "–";
    B.growth.forEach((g, i) => { $("hg" + (i + 1)).textContent = g === null ? "" : fmtH(g); $("hmx" + (i + 1)).textContent = g === null ? "" : fmtH(B.maint[i]); });
    $("h-mcx").textContent = B.n ? fmtH(B.mcx) : "–";
    if (changed === "B" && B.n) writeField("mcx", Math.round(B.mcx * 1000) / 1000);
  }
  hfields.forEach((f) => {
    const k = f.dataset.h;
    const group = /^h[er]\d/.test(k) ? "A" : "B";
    f.addEventListener("input", (ev) => { ev.stopPropagation(); runHelpers(group); render("typing"); });
    f.addEventListener("blur", () => { const v = parseNumber(f.value); if (ok(v) && Math.abs(v) >= 1000) f.value = fmtInput(v); });
  });

  function values() {
    const v = { via: via.value };
    settings.forEach((k) => { v[k] = $(k).value; });
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    hfields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.h] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }

  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (ev) => { if (ev.target.dataset && ev.target.dataset.h) return; render("typing"); });
  via.addEventListener("change", () => { applyMode(); render("typing"); });
  settings.forEach((k) => $(k).addEventListener("change", () => render("typing")));
  fields.forEach((f) => f.addEventListener("blur", () => {
    const v = parseNumber(f.value);
    if (ok(v) && Math.abs(v) >= 1000) f.value = fmtInput(v);
    render("blur");
  }));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => { $("stickybar").classList.toggle("away", e.isIntersecting); }).observe($("verdict"));
  }
  $("share-link").addEventListener("click", () => {
    const url = shareUrl(values());
    try { history.replaceState(null, "", url); } catch (e) { /* sandboxed preview */ }
    copyText(url).then(() => {
      const b = $("share-link"); b.textContent = "Link copied";
      setTimeout(() => { b.textContent = "Copy link to this calculation"; }, 2000);
    }).catch(() => {});
    track("share_calculation", { tool: "greenwald" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    hfields.forEach((f) => { f.value = ""; });
    via.value = "y"; applyMode();
    showErrors([]); clearAll(); runHelpers(); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });

  const q = readQuery();
  if (Object.keys(q).length) {
    settings.forEach((k) => { if (q[k] && [...$(k).options].some((o) => o.value === q[k])) $(k).value = q[k]; });
    if (q.via === "n" || q.via === "y") via.value = q.via;
    fields.forEach((f) => {
      if (q[f.dataset.k] === undefined) return;
      const v = parseNumber(q[f.dataset.k]);
      f.value = ok(v) && Math.abs(v) >= 1000 ? fmtInput(v) : q[f.dataset.k];
    });
    hfields.forEach((f) => { if (q[f.dataset.h] !== undefined) { f.value = q[f.dataset.h]; f.closest("details").open = true; } });
    applyMode(); runHelpers(); render("link");
  } else {
    applyMode(); runHelpers(); render("typing");
  }
}
