// Graham's formulas: The Intelligent Investor (rev. 1973), ch. 11 and 14, plus Graham's 1974 bond-yield version.
// Same formulas as Graham_Formulas_Template.xlsx; the cell of each line is noted.
import { parseNumber, perShare, multiple, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

const num = (v) => typeof v === "number" && isFinite(v);

// Inputs: blank = null. Rates as fractions.
export function compute(x) {
  const eps = x.eps ?? 0, g = x.g ?? 0, p = x.p ?? 0;
  const mult = 8.5 + 2 * g * 100;                                          // C13
  const val = eps * mult;                                                  // C14
  const mos = val > 0 ? 1 - p / val : 0;                                   // C15
  const ig = eps > 0 ? (p / eps - 8.5) / 2 / 100 : null;                   // C16
  const y = x.y ?? 0;
  const valy = y > 0 ? val * 0.044 / y : 0;                                // C20
  const mosy = valy > 0 ? 1 - p / valy : 0;                                // C21
  const igy = eps > 0 && y > 0 ? (p / eps * y / 0.044 - 8.5) / 2 / 100 : null; // C22

  const es = [x.e1, x.e2, x.e3].filter((v) => v !== null && v !== undefined);
  const avg = es.length ? es.reduce((a, b) => a + b, 0) / es.length : 0;   // C28
  const bv = x.bv ?? 0;
  const pe = avg > 0 ? p / avg : null;                                     // C30
  const pb = bv > 0 ? p / bv : null;                                       // C31
  const pepb = pe !== null && pb !== null ? pe * pb : null;                // C32
  const gn = avg > 0 && bv > 0 ? Math.sqrt(22.5 * avg * bv) : 0;           // C33
  const vsgn = gn > 0 ? p / gn - 1 : null;                                 // C34
  const t67 = pepb === null ? "n/m" : pepb <= 22.5 ? "Pass" : "Fail";      // C35

  const t1 = !x.minsales ? "Set a minimum" : (x.sales ?? 0) >= x.minsales ? "Pass" : "Fail"; // C40
  const cr = (x.cl ?? 0) > 0 ? (x.ca ?? 0) / x.cl : null;                  // C44
  const t2 = !x.cl ? "n/m" : cr !== null && cr >= 2 && (x.ltd ?? 0) <= (x.ca ?? 0) - x.cl ? "Pass" : "Fail"; // C45
  const t3 = x.ypos === null || x.ypos === undefined ? "n/m" : x.ypos >= 10 ? "Pass" : "Fail"; // C47
  const t4 = x.ydiv === null || x.ydiv === undefined ? "n/m" : x.ydiv >= 20 ? "Pass" : "Fail"; // C49
  const eg = (x.e10 ?? 0) > 0 && avg > 0 ? avg / x.e10 - 1 : null;       // C51
  const t5 = eg === null ? "n/m" : eg >= 1 / 3 ? "Pass" : "Fail";         // C52
  const n = [t1, t2, t3, t4, t5].filter((t) => t === "Pass").length
    + (pe !== null && pe <= 15 ? 1 : 0) + (pb !== null && (pb <= 1.5 || (pepb !== null && pepb <= 22.5)) ? 1 : 0); // C53
  return { mult, val, mos, ig, valy, mosy, igy, avg, pe, pb, pepb, gn, vsgn, t67, t1, cr, t2, t3, t4, eg, t5, n };
}

// Helper A: ten years of EPS, newest first (template C57:C70). Blank years are skipped.
export function helperEPS(eps10) {
  const mean = (xs) => { const v = xs.filter((n) => n !== null && n !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const avg3 = mean(eps10.slice(0, 3)), avg810 = mean(eps10.slice(7, 10));
  const pos = eps10.filter((n) => n !== null && n !== undefined && n > 0).length;
  const g = avg3 > 0 && avg810 > 0 ? Math.pow(avg3 / avg810, 1 / 7) - 1 : null;
  return { avg3, avg810, pos, g };
}
// Helper B: book value per share (C75).
export function helperBV(eq, shares) { return shares > 0 ? eq / shares : 0; }

export function check(x, raw) {
  const errors = [], warnings = [];
  const neg = new Set(["eps", "e1", "e2", "e3", "bv", "e10"]);
  for (const [k, v] of Object.entries(raw)) {
    if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
    else if (v !== null && v < 0 && !neg.has(k)) errors.push([k, "Can't be negative."]);
  }
  if (raw.p === null) errors.push(["p", "Needed for the calculation."]);
  if (raw.p === 0) errors.push(["p", "Price can't be zero."]);
  if (raw.ypos !== null && raw.ypos > 10) errors.push(["ypos", "10 at most."]);
  if (errors.length) return { errors, warnings };
  if (x.g !== null && x.g > 0.08) warnings.push("You expect more than 8% growth a year. Graham's own warning: above about 8% there's no realistic way to value a company, and the formula gives a number anyway.");
  if (x.eps !== null && x.eps <= 0) warnings.push("With zero or negative earnings the growth formula doesn't mean anything.");
  if (x.y !== null && x.y > 0 && x.y < 0.02) warnings.push("A bond yield under 2% makes the 1974 version huge. Check the rate and the currency.");
  if (x.bv !== null && x.bv <= 0) warnings.push("Book value is zero or negative, so there's no Graham number.");
  return { errors, warnings };
}

export function interpret(x, r, cur) {
  const ps = (v) => perShare(v, cur, x.p);
  const parts = [];
  if (x.eps !== null && x.eps > 0) {
    let s = `By Graham's formula, ${ps(x.p)} prices in ${pct(r.ig, 1)} growth a year for the next 7 to 10 years`;
    if (r.igy !== null) s += ` (${pct(r.igy, 1)} with today's bond yield)`;
    s += ".";
    if (x.g !== null) s += ` At your ${pct(x.g, 1)}, the formula gives ${ps(r.val)}${r.valy > 0 ? `, or ${ps(r.valy)} adjusted for bonds` : ""}.`;
    parts.push(s);
  }
  if (r.gn > 0) parts.push(`The Graham number is ${ps(r.gn)}, so the price is ${pct(Math.abs(r.vsgn))} ${r.vsgn > 0 ? "above" : "below"} it and ${r.t67 === "Pass" ? "passes" : "fails"} his P/E × P/B test.`);
  const used = ["sales", "ca", "ypos", "ydiv", "e10"].some((k) => x[k] !== null);
  if (used) parts.push(`It passes ${r.n} of Graham's 7 tests for the defensive investor.`);
  return parts.length ? parts.join(" ") : "Fill in section 1 or 2 to see a result.";
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined") {
  const form = document.getElementById("grform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const ok = (v) => v !== null && !Number.isNaN(v);

  function read() {
    const raw = {}, x = {};
    fields.forEach((f) => {
      const k = f.dataset.k, v = parseNumber(f.value); raw[k] = v;
      x[k] = ok(v) ? (f.dataset.kind === "percent" ? v / 100 : v) : null;
    });
    return { raw, x, cur: $("cur").value };
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
  const clearAll = () => form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, x, cur } = read();
    const { errors, warnings } = check(x, raw);
    showErrors(errors, source === "typing");
    const warn = $("warnings"), verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) {
      clearAll(); warn.hidden = true; bar.hidden = true;
      verdict.innerHTML = `<p>${errors.some(([, m]) => m.startsWith("Needed")) ? "Fill in the share price, then section 1 or 2." : "Fix the fields marked above."}</p>`;
      return;
    }
    const r = compute(x);
    warn.hidden = !warnings.length;
    warn.innerHTML = warnings.length ? `<p class="kicker">Worth a second look</p>` + warnings.map((w) => `<p>${w}</p>`).join("") : "";
    const ps = (v) => perShare(v, cur, x.p);
    const has1 = x.eps !== null, hasG = x.g !== null, hasY = x.y !== null && x.y > 0;
    set("o-mult", hasG ? r.mult.toFixed(1) : "–");
    set("o-val", has1 && hasG ? ps(r.val) : "–", r.val < 0);
    set("o-mos", has1 && hasG && r.val > 0 ? pct(r.mos) : "–", r.mos < 0);
    set("o-ig", r.ig === null ? (has1 ? "n/m" : "–") : pct(r.ig, 1), r.ig !== null && r.ig < 0);
    set("o-valy", has1 && hasG && hasY ? ps(r.valy) : "–");
    set("o-mosy", has1 && hasG && hasY && r.valy > 0 ? pct(r.mosy) : "–", r.mosy < 0);
    set("o-igy", r.igy === null ? "–" : pct(r.igy, 1), r.igy !== null && r.igy < 0);
    const has2 = [x.e1, x.e2, x.e3].some((v) => v !== null);
    set("o-avg", has2 ? ps(r.avg) : "–", r.avg < 0);
    set("o-pe", r.pe === null ? (has2 ? "n/m" : "–") : multiple(r.pe).replace(/0x$/, "x"));
    set("o-pb", r.pb === null ? (x.bv !== null ? "n/m" : "–") : multiple(r.pb));
    set("o-pepb", r.pepb === null ? "–" : r.pepb.toFixed(1));
    set("o-gn", r.gn > 0 ? ps(r.gn) : has2 || x.bv !== null ? "n/m" : "–");
    set("o-vsgn", r.vsgn === null ? "–" : (r.vsgn > 0 ? pct(r.vsgn) + " above" : pct(-r.vsgn) + " below"));
    set("x-t67", r.t67 === "n/m" ? "–" : r.t67);
    set("x-t1", x.sales === null ? "–" : r.t1);
    set("o-cr", r.cr === null ? "–" : r.cr.toFixed(2));
    ["t2", "t3", "t4", "t5"].forEach((k) => set("x-" + k, r[k] === "n/m" ? "–" : r[k]));
    set("o-eg", r.eg === null ? "–" : pct(r.eg), r.eg !== null && r.eg < 0);
    set("o-n", String(r.n));

    const tag = r.gn > 0 ? (r.t67 === "Pass" ? ["Under the Graham number", ""] : ["Over the Graham number", " fail"])
      : r.ig !== null ? [`Prices in ${pct(r.ig, 1)} growth`, r.ig > 0.08 ? " fail" : ""] : ["Graham's formulas", ""];
    verdict.innerHTML = `<span class="tag${tag[1]}">${tag[0]}</span><p>${interpret(x, r, cur)}</p>`;
    bar.hidden = !(r.gn > 0 || r.ig !== null);
    bar.innerHTML = `<span>${r.gn > 0 ? "Graham number " + ps(r.gn) : "Implied growth " + pct(r.ig ?? 0, 1)}</span><span>${r.n}/7 tests ↓</span>`;

    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "graham", result: tag[0], source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }
  // ── Helpers ──
  const hfields = [...form.querySelectorAll("input[data-h]")];
  const hv = (k) => { const el = form.querySelector(`input[data-h="${k}"]`); const v = el ? parseNumber(el.value) : null; return ok(v) ? v : null; };
  const r2 = (v) => String(Math.round(v * 10000) / 10000);
  const fill = (k, v) => { const f = $("f-" + k); if (f) f.value = v; };
  let A = null;
  function runHelpers(changed) {
    const eps10 = Array.from({ length: 10 }, (_, i) => hv("he" + (i + 1)));
    const any = eps10.some((v) => v !== null);
    A = helperEPS(eps10);
    $("h-latest").textContent = eps10[0] === null ? "–" : eps10[0].toFixed(2);
    $("h-avg3").textContent = any ? A.avg3.toFixed(2) : "–";
    $("h-avg810").textContent = any ? A.avg810.toFixed(2) : "–";
    $("h-pos").textContent = any ? `${A.pos} of ${eps10.filter((v) => v !== null).length}` : "–";
    $("h-g").textContent = A.g === null ? "–" : pct(A.g, 1);
    form.querySelectorAll(".hbtn").forEach((b) => { b.disabled = !any || (b.dataset.use === "g" && A.g === null); });
    if (changed === "A" && any) {
      [0, 1, 2].forEach((i) => { if (eps10[i] !== null) fill("e" + (i + 1), String(eps10[i])); });
      if (eps10.slice(7).some((v) => v !== null)) fill("e10", r2(A.avg810));
      if (eps10.every((v) => v !== null)) fill("ypos", String(A.pos));
    }
    const eq = hv("heq"), sh = hv("hsh");
    const bv = eq !== null && sh ? helperBV(eq, sh) : null;
    $("h-bv").textContent = bv === null ? "–" : bv.toFixed(2);
    if (changed === "B" && bv !== null) fill("bv", r2(bv));
  }
  hfields.forEach((f) => f.addEventListener("input", (ev) => { ev.stopPropagation(); runHelpers(f.dataset.h.startsWith("he") ? "A" : "B"); render("typing"); }));
  form.querySelectorAll(".hbtn").forEach((b) => b.addEventListener("click", () => {
    if (!A) return;
    const e1 = hv("he1");
    if (b.dataset.use === "latest" && e1 !== null) fill("eps", String(e1));
    if (b.dataset.use === "avg3") fill("eps", r2(A.avg3));
    if (b.dataset.use === "g" && A.g !== null) fill("g", r2(A.g * 100));
    render("typing");
  }));

  function values() {
    const v = { cur: $("cur").value };
    fields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.k] = f.value.replace(/[\s,]/g, ""); });
    hfields.forEach((f) => { if (f.value.trim() !== "") v[f.dataset.h] = f.value.replace(/[\s,]/g, ""); });
    return v;
  }
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (ev) => { if (ev.target.dataset && ev.target.dataset.h) return; render("typing"); });
  $("cur").addEventListener("change", () => render("typing"));
  fields.forEach((f) => f.addEventListener("blur", () => render("blur")));
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { $("stickybar").classList.toggle("away", e.isIntersecting); }).observe($("verdict"));
  $("share-link").addEventListener("click", () => {
    const url = shareUrl(values());
    try { history.replaceState(null, "", url); } catch (e) { /* preview */ }
    copyText(url).then(() => { const b = $("share-link"); b.textContent = "Link copied"; setTimeout(() => { b.textContent = "Copy link to this calculation"; }, 2000); }).catch(() => {});
    track("share_calculation", { tool: "graham" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = ""; }); hfields.forEach((f) => { f.value = ""; }); showErrors([]); clearAll(); runHelpers(); render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  const q = readQuery();
  if (q.cur && [...$("cur").options].some((o) => o.value === q.cur)) $("cur").value = q.cur;
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  hfields.forEach((f) => { if (q[f.dataset.h] !== undefined) { f.value = q[f.dataset.h]; f.closest("details").open = true; } });
  runHelpers();
  render(Object.keys(q).length ? "link" : "typing");
}
