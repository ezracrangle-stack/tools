// Free cash flow, recast: Mauboussin & Callahan, "Categorizing for Clarity" (Counterpoint Global, Oct 2021).
// Same formulas as Mauboussin_FCF_Template.xlsx; the cell of each line is noted.
import { parseNumber, amount, pct, multiple, track, shareUrl, readQuery, copyText } from "./calc.js";

// Outflows typed as positive numbers; section totals signed. Blank = 0 unless noted.
export function compute(x) {
  const v = (k) => x[k] || 0;
  const I = x.intg === "y" ? v("ii") : 0, A = x.intg === "y" ? v("ia") : 0;
  const msAdj = x.ms === "y" ? v("msp") - v("mss") : 0;
  const cfoA = v("cfo") - v("sbc") + I;                                   // H42
  const cfiA = v("cfi") - v("lease") - I + msAdj;                         // H43
  const cffA = v("cff") + v("sbc") + v("lease");                          // H44
  const niA = v("ni") + I - A;                                            // C46
  const dcfo = v("cfo") !== 0 ? cfoA / v("cfo") - 1 : null;               // C47
  const dcfi = v("cfi") !== 0 ? cfiA / v("cfi") - 1 : null;               // C48
  const ncx = v("capex") - v("prc");                                      // C51
  const fcf = v("cfo") - ncx;                                             // C52
  const fcfS = fcf - v("sbc"), fcfL = fcf - v("lease"), fcfSL = fcf - v("sbc") - v("lease"); // C53-C55
  const sbcCfo = v("cfo") !== 0 ? v("sbc") / v("cfo") : null;             // C56
  const sbcFcf = fcf > 0 ? v("sbc") / fcf : null;                         // C57
  const shrink = fcf > 0 ? fcfSL / fcf - 1 : null;                        // C58
  const inv = ncx + v("lease") + I + v("acq");                            // C65
  const invRep = ncx + v("acq");                                          // C66
  const invX = invRep > 0 ? inv / invRep : null;                          // C67
  const invCfo = cfoA > 0 ? inv / cfoA : null;                            // C68
  const ebitdaA = v("ebitda") + I;                                        // C71
  const evR = v("ebitda") > 0 ? v("ev") / v("ebitda") : null;             // C72
  const evA = ebitdaA > 0 ? v("ev") / ebitdaA : null;                     // C73
  const mcap = v("sh") * v("p");
  const yR = mcap > 0 ? fcf / mcap : null, yA = mcap > 0 ? fcfSL / mcap : null; // C74-C75
  return { I, A, cfoA, cfiA, cffA, niA, dcfo, dcfi, ncx, fcf, fcfS, fcfL, fcfSL, sbcCfo, sbcFcf, shrink, inv, invRep, invX, invCfo, ebitdaA, evR, evA, mcap, yR, yA };
}

// Helper A: intangible investment this year and straight-line amortization of the 5 prior years (C83-C84).
// Each line: [this year, % investment, life, 1..5 years ago]; amortization starts the year after the spending.
export function helperIntangibles(lines) {
  let I = 0, A = 0;
  for (const [amt, share, life, ...past] of lines) {
    I += (amt || 0) * (share || 0);
    if (life > 0) A += (share || 0) * past.slice(0, Math.min(5, life)).reduce((s, p) => s + (p || 0), 0) / life;
  }
  return { I, A };
}

export function check(x, raw, signed) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
    else if (v !== null && v < 0 && !signed.has(k)) errors.push([k, "Type it as a positive number."]);
  }
  if (raw.cfo === null) errors.push(["cfo", "Needed for the calculation."]);
  if (raw.capex === null) errors.push(["capex", "Needed for the calculation."]);
  if (errors.length) return { errors, warnings };
  if (x.intg === "y" && !x.ii) warnings.push("You chose to move intangible investment but didn't enter it. Use the helper, or switch the option off.");
  if (x.intg === "y" && x.ii && !x.ia) warnings.push("No amortization of past intangible investment: adjusted net income will be too high. The helper works it out from five years of spending.");
  if (x.sbc && x.cfo > 0 && x.sbc / x.cfo > 0.25) warnings.push("Stock pay is more than a quarter of operating cash flow. That's in the top half even for tech companies (the paper's median for information technology is 25%).");
  if ((x.cfi === null || x.cff === null)) warnings.push("Add the investing and financing totals to see the recast statement.");
  return { errors, warnings };
}

export function interpret(x, r, cur, u) {
  const unit = u === 1000000 ? " million" : u === 1000 ? " thousand" : "";
  const a = (v) => `${cur} ${amount(v, u)}${unit}`;
  if (r.fcf <= 0) return `Popular free cash flow is ${a(r.fcf)}: the company spends more on equipment than its operations bring in. Negative free cash flow is fine when the investment earns a good return.`;
  let s = `Popular free cash flow is ${a(r.fcf)}. Take out stock pay and leased assets and it's ${a(r.fcfSL)}, ${pct(-r.shrink)} less.`;
  if (x.intg === "y" && r.I) s += ` Counting intangibles, the company invests ${a(r.inv)}, ${multiple(r.invX)} what the statement shows; free cash flow stays the same.`;
  return s;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("fcfform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const choices = [...form.querySelectorAll("select[data-choice]")];
  const signed = new Set(fields.filter((f) => f.dataset.signed).map((f) => f.dataset.k));
  const settings = ["cur", "u", "su"];
  const ok = (v) => v !== null && !Number.isNaN(v);
  const fmtInput = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });

  function read() {
    const raw = {}, x = {};
    const u = Number($("u").value), su = Number($("su").value);
    fields.forEach((f) => {
      const k = f.dataset.k, v = parseNumber(f.value); raw[k] = v;
      const n = ok(v) ? v : null;
      x[k] = n === null ? null : f.dataset.kind === "money" ? n * u : f.dataset.kind === "shares" ? n * su : n;
    });
    choices.forEach((c) => { x[c.dataset.choice] = c.value; });
    return { raw, x, u, cur: $("cur").value };
  }
  function showErrors(errors, quiet) {
    fields.forEach((f) => { f.removeAttribute("aria-invalid"); const e = f.parentElement.querySelector(".err"); if (e) e.remove(); });
    errors.forEach(([k, msg]) => {
      const f = form.querySelector(`input[data-k="${k}"]`);
      if (!f || f.getAttribute("aria-invalid")) return;
      if (quiet && f.value.trim() === "" && msg.startsWith("Needed")) return;
      f.setAttribute("aria-invalid", "true");
      const e = document.createElement("span"); e.className = "err"; e.textContent = msg; f.insertAdjacentElement("afterend", e);
    });
  }
  const set = (id, text, neg) => { const el = $(id); if (!el) return; el.textContent = text; el.classList.toggle("neg", !!neg); };
  const clearAll = () => form.querySelectorAll("output").forEach((o) => { if (o.closest(".helper")) return; o.textContent = "–"; o.classList.remove("neg"); });
  function applyMode() {
    const on = $("f-intg").value === "y";
    form.querySelectorAll(".intang").forEach((el) => el.classList.toggle("off", !on));
  }

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x, u, cur } = read();
    const { errors, warnings } = check(x, raw, signed);
    showErrors(errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) {
      clearAll(); warn.hidden = true; bar.hidden = true;
      verdict.innerHTML = `<p>${errors.some(([, m]) => m.startsWith("Needed")) ? "Fill in operating cash flow and capex and the results appear as you type." : "Fix the fields marked above."}</p>`;
      return;
    }
    const r = compute(x);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";
    const a = (v) => amount(v, u), p = (v) => (v === null ? "n/m" : pct(v));
    set("o-fcf", a(r.fcf), r.fcf < 0); set("o-fcfS", a(r.fcfS), r.fcfS < 0); set("o-fcfL", a(r.fcfL), r.fcfL < 0); set("o-fcfSL", a(r.fcfSL), r.fcfSL < 0);
    set("o-sbcCfo", p(r.sbcCfo)); set("o-sbcFcf", p(r.sbcFcf)); set("o-shrink", p(r.shrink), r.shrink !== null && r.shrink < 0);
    set("o-niA", x.ni === null ? "–" : a(r.niA), r.niA < 0);
    const haveAll = x.cfi !== null && x.cff !== null;
    [["cfo", x.cfo, r.cfoA, r.dcfo], ["cfi", x.cfi, r.cfiA, r.dcfi], ["cff", x.cff, r.cffA, null]].forEach(([k, rep, adj, d]) => {
      const known = k === "cfo" || haveAll;
      set("t-" + k + "R", rep === null ? "–" : a(rep), rep < 0);
      set("t-" + k + "A", known ? a(adj) : "–", adj < 0);
      if (k !== "cff") set("t-" + k + "D", known && d !== null ? (d >= 0 ? "+" : "") + pct(d) : "–");
    });
    set("o-inv", a(r.inv)); set("o-invRep", a(r.invRep)); set("o-invX", r.invX === null ? "n/m" : multiple(r.invX));
    set("o-invCfo", r.invCfo === null ? "n/m" : pct(r.invCfo));
    set("o-evR", x.ev && r.evR !== null ? multiple(r.evR) : "–"); set("o-evA", x.ev && r.evA !== null ? multiple(r.evA) : "–");
    set("o-yR", r.yR === null ? "–" : pct(r.yR, 1), r.yR < 0); set("o-yA", r.yA === null ? "–" : pct(r.yA, 1), r.yA < 0);

    const tag = r.fcf <= 0 ? ["Negative free cash flow", " fail"] : r.shrink !== null && r.shrink < -0.3 ? [`FCF ${pct(-r.shrink)} smaller`, " fail"] : [`FCF ${pct(-(r.shrink || 0))} smaller`, ""];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, r, cur, u)}</p>`;
    bar.hidden = false;
    bar.innerHTML = `<span>FCF ${a(r.fcf)} → ${a(r.fcfSL)}</span><span>${tag[0].split(" ")[0] === "Negative" ? "Negative" : "Recast"} ↓</span>`;
    const sig = JSON.stringify([raw, x.intg, x.ms, $("u").value]);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "fcf", result: tag[0], source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  // ── Helper ──
  const hfields = [...form.querySelectorAll("input[data-h]")];
  const hv = (k) => { const el = form.querySelector(`input[data-h="${k}"]`); const v = el ? parseNumber(el.value) : null; return ok(v) ? v : null; };
  function runHelper(changed) {
    const lines = [1, 2, 3].map((n) => [hv(`l${n}a`), (hv(`l${n}p`) ?? 0) / 100, hv(`l${n}l`), ...[1, 2, 3, 4, 5].map((k) => hv(`l${n}y${k}`))]);
    const any = hfields.some((f) => f.value.trim() !== "");
    const H = helperIntangibles(lines);
    set("h-ii", any ? H.I.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "–");
    set("h-ia", any ? H.A.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "–");
    if (changed && any) {
      const w = (k, val) => { const f = $("f-" + k); const s = Math.round(val * 10) / 10; f.value = Math.abs(s) >= 1000 ? fmtInput(s) : String(s); };
      w("ii", H.I); w("ia", H.A);
      if ($("f-intg").value !== "y") { $("f-intg").value = "y"; applyMode(); }
    }
  }
  hfields.forEach((f) => f.addEventListener("input", (ev) => { ev.stopPropagation(); runHelper(true); render("typing"); }));

  function values() {
    const v = {};
    settings.forEach((k) => { v[k] = $(k).value; });
    choices.forEach((c) => { v[c.dataset.choice] = c.value; });
    fields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    hfields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.h] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (ev) => { if (ev.target.dataset && ev.target.dataset.h) return; render("typing"); });
  choices.forEach((c) => c.addEventListener("change", () => { applyMode(); render("typing"); }));
  settings.forEach((k) => $(k).addEventListener("change", () => render("typing")));
  fields.forEach((f) => f.addEventListener("blur", () => { const v = parseNumber(f.value); if (ok(v) && Math.abs(v) >= 1000) f.value = fmtInput(v); render("blur"); }));
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { $("stickybar").classList.toggle("away", e.isIntersecting); }).observe($("verdict"));
  $("share-link").addEventListener("click", () => {
    const url = shareUrl(values());
    try { history.replaceState(null, "", url); } catch (e) { /* preview */ }
    copyText(url).then(() => { const b = $("share-link"); b.textContent = "Link copied"; setTimeout(() => { b.textContent = "Copy link to this calculation"; }, 2000); }).catch(() => {});
    track("share_calculation", { tool: "fcf" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = ""; }); hfields.forEach((f) => { f.value = ""; });
    choices.forEach((c) => { c.value = "n"; }); applyMode(); showErrors([]); clearAll(); runHelper(false); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  const q = readQuery();
  settings.forEach((k) => { if (q[k] && [...$(k).options].some((o) => o.value === q[k])) $(k).value = q[k]; });
  choices.forEach((c) => { if (q[c.dataset.choice] === "y" || q[c.dataset.choice] === "n") c.value = q[c.dataset.choice]; });
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) { const v = parseNumber(q[f.dataset.k]); f.value = ok(v) && Math.abs(v) >= 1000 ? fmtInput(v) : q[f.dataset.k]; } });
  hfields.forEach((f) => { if (q[f.dataset.h] !== undefined) { f.value = q[f.dataset.h]; f.closest("details").open = true; } });
  applyMode(); runHelper(false); render(Object.keys(q).length ? "link" : "typing");
}
