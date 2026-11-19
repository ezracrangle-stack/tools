// Measuring the moat: two numbers from Mauboussin and Callahan, "Measuring the Moat" (Counterpoint Global, 2024).
// Same arithmetic as Measuring_The_Moat_Template.xlsx.
// A. ROIC = NOPAT margin x invested capital turnover, company against its peers combined.
// B. Market share instability (average absolute change in share) and concentration (HHI, top four).
import { parseNumber, pct, track, shareUrl, readQuery, copyText } from "./calc.js";

const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);

// cos: [{rev, nopat, ic}] — index 0 is the company, 1.. are peers. wacc as a decimal or null.
export function drivers(cos, wacc = null) {
  const rows = cos.map((c) => {
    const margin = c.rev > 0 && has(c.nopat) ? c.nopat / c.rev : null;
    const turn = c.rev > 0 && c.ic > 0 ? c.rev / c.ic : null;
    const roic = c.ic > 0 && has(c.nopat) ? c.nopat / c.ic : null;
    return { margin, turn, roic, spread: roic !== null && has(wacc) ? roic - wacc : null };
  });
  const peers = cos.slice(1).filter((c) => c.rev > 0 && has(c.nopat) && c.ic > 0);
  const n = peers.length;
  const sum = (k) => peers.reduce((s, c) => s + c[k], 0);
  const R = sum("rev"), P = sum("nopat"), I = sum("ic");
  const peer = { n, rev: R, nopat: P, ic: I,
    margin: n ? P / R : null, turn: n && I > 0 ? R / I : null, roic: n && I > 0 ? P / I : null };
  const f = rows[0] || {};
  const gap = has(f.roic) && peer.roic !== null ? f.roic - peer.roic : null;
  const mr = has(f.margin) && peer.margin > 0 && f.margin > 0 ? f.margin / peer.margin : null;
  const tr = has(f.turn) && peer.turn > 0 ? f.turn / peer.turn : null;
  let source = null;
  if (gap !== null && mr !== null && tr !== null) {
    source = gap <= 0 ? "none" : mr > 1.1 && tr > 1.1 ? "both" : mr >= tr ? "margin" : "turnover";
  }
  return { rows, peer, gap, mr, tr, source };
}

// list: [{a, b}] values in the earlier and later year (sales, units or %). Blank = null.
export function shares(list) {
  const live = list.filter((x) => has(x.a) || has(x.b));
  const A = live.reduce((s, x) => s + (has(x.a) ? x.a : 0), 0), B = live.reduce((s, x) => s + (has(x.b) ? x.b : 0), 0);
  const rows = list.map((x) => {
    if (!(has(x.a) || has(x.b))) return { sa: null, sb: null, ch: null };
    const sa = A > 0 ? (has(x.a) ? x.a : 0) / A : null, sb = B > 0 ? (has(x.b) ? x.b : 0) / B : null;
    return { sa, sb, ch: sa !== null && sb !== null ? Math.abs(sb - sa) : null };
  });
  const ch = rows.filter((r) => r.ch !== null).map((r) => r.ch);
  const n = ch.length;
  const avg = n ? ch.reduce((s, v) => s + v, 0) / n : null;
  const hhi = (k) => (n ? rows.reduce((s, r) => s + (r[k] !== null ? (r[k] * 100) ** 2 : 0), 0) : null);
  const top4 = (k) => (n ? rows.map((r) => r[k] || 0).sort((p, q) => q - p).slice(0, 4).reduce((s, v) => s + v, 0) : null);
  return { rows, totalA: A, totalB: B, n, avg, stable: avg === null ? null : avg <= 0.02,
    hhiA: hhi("sa"), hhiB: hhi("sb"), high: n ? hhi("sb") > 1800 : null, top4A: top4("sa"), top4B: top4("sb") };
}

export function check(raw) {
  const errors = [];
  for (const [k, v] of Object.entries(raw)) if (Number.isNaN(v)) errors.push([k, "Numbers only."]);
  for (const [k, v] of Object.entries(raw)) {
    if (!has(v)) continue;
    if ((/^(rev|ic|a|b)\d/.test(k) || k === "wacc" || k === "yrs") && v < 0) errors.push([k, "Can't be negative."]);
  }
  return errors;
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("moatform")) {
  const form = document.getElementById("moatform");
  const $ = (id) => document.getElementById(id);
  const fields = [...form.querySelectorAll("input[data-k]")];
  const NC = 5, NS = 15;
  const X = (v) => (v === null ? "–" : v.toFixed(2) + "x");
  const P = (v, d = 1) => (v === null ? "–" : pct(v, d));
  const SRC = { none: "No ROIC edge over peers", both: "Both: margin and turnover", margin: "Margin: differentiation", turnover: "Turnover: cost leadership" };

  function read() {
    const raw = {};
    fields.forEach((f) => { if (!f.dataset.text) raw[f.dataset.k] = parseNumber(f.value); });
    const g = (k) => (has(raw[k]) ? raw[k] : null);
    const cos = [...Array(NC)].map((_, i) => ({ rev: g("rev" + i), nopat: g("nopat" + i), ic: g("ic" + i) }));
    const list = [...Array(NS)].map((_, i) => ({ a: g("a" + i), b: g("b" + i) }));
    return { raw, cos, list, wacc: has(raw.wacc) ? raw.wacc / 100 : null, yrs: has(raw.yrs) ? raw.yrs : 5 };
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
  const name = (i) => { const f = form.querySelector(`input[data-k="n${i}"]`); return (f && f.value.trim()) || (i === 0 ? "The company" : `Peer ${i}`); };

  let lastSig = "", timer = null;
  function render(source) {
    const { raw, cos, list, wacc, yrs } = read();
    const errors = check(raw);
    showErrors(errors);
    const verdict = $("verdict"), bar = $("stickybar");
    if (errors.length) { verdict.innerHTML = "<p>Fix the fields marked above.</p>"; bar.hidden = true; return; }
    const d = drivers(cos, wacc), s = shares(list);
    d.rows.forEach((r, i) => {
      set(`lbl${i}`, name(i));
      set(`m${i}`, P(r.margin)); set(`t${i}`, X(r.turn)); set(`r${i}`, P(r.roic), r.roic !== null && r.roic < 0);
      set(`s${i}`, P(r.spread), r.spread !== null && r.spread < 0);
    });
    set("pm", P(d.peer.margin)); set("pt", X(d.peer.turn)); set("pr", P(d.peer.roic));
    set("o-gap", d.gap === null ? "–" : (d.gap >= 0 ? "+" : "−") + pct(Math.abs(d.gap), 1), d.gap !== null && d.gap < 0);
    set("o-mr", X(d.mr)); set("o-tr", X(d.tr));
    set("x-src", d.source ? SRC[d.source] : "–");

    s.rows.forEach((r, i) => { set(`sa${i}`, P(r.sa)); set(`sb${i}`, P(r.sb)); set(`ch${i}`, P(r.ch)); });
    set("o-avg", P(s.avg)); set("x-stab", s.stable === null ? "–" : s.stable ? "Stable" : "Unstable", s.stable === false);
    set("o-hhia", s.hhiA === null ? "–" : Math.round(s.hhiA).toLocaleString("en-US"));
    set("o-hhib", s.hhiB === null ? "–" : Math.round(s.hhiB).toLocaleString("en-US"));
    set("x-conc", s.high === null ? "–" : s.high ? "Highly concentrated" : "Not highly concentrated");
    set("o-c4a", P(s.top4A)); set("o-c4b", P(s.top4B));

    const parts = [];
    if (d.source) {
      const nm = name(0);
      if (d.source === "none") parts.push(`<strong>${nm} earns no more on its capital than its peers</strong> (${P(d.rows[0].roic)} against ${P(d.peer.roic)}).`);
      else {
        const why = { margin: "its margin, which points to differentiation", turnover: "how hard it works its capital, which points to cost leadership", both: "both a higher margin and a higher turnover, which points to differentiation and cost leadership together" }[d.source];
        parts.push(`<strong>${nm} earns ${P(d.rows[0].roic)} on its capital, against ${P(d.peer.roic)} for its peers.</strong> The edge comes from ${why}. Margin ${X(d.mr)} the peers', turnover ${X(d.tr)}.`);
      }
    }
    if (s.avg !== null) {
      parts.push(`<strong>Market shares moved ${P(s.avg)} on average</strong> over ${yrs} year${yrs === 1 ? "" : "s"}: ${s.stable ? "a relatively stable industry by Mauboussin's rule" : "an unstable industry by Mauboussin's rule"}${yrs !== 5 ? " (his rule is for five-year changes)" : ""}. HHI ${Math.round(s.hhiB).toLocaleString("en-US")}${s.high ? ", highly concentrated" : ""}.`);
    }
    if (!parts.length) { verdict.innerHTML = "<p>Fill in a company and at least one peer, or the market shares, and the results appear as you type.</p>"; bar.hidden = true; return; }
    parts.push("Numbers point you to questions; the moat itself is in the industry and the company's strategy.");
    verdict.innerHTML = `<p>${parts.join(" ")}</p>`;
    bar.hidden = false;
    const bits = [d.source ? SRC[d.source].split(":")[0] : "", s.avg !== null ? `Shares ${P(s.avg)}` : ""].filter(Boolean);
    bar.innerHTML = `<span>${bits.join(" · ")}</span><span>↓</span>`;
    const sig = JSON.stringify(raw);
    clearTimeout(timer);
    if (sig !== lastSig) {
      const send = () => { lastSig = sig; track("calculate", { tool: "moat", result: bits.join(" "), source }); };
      if (source === "typing") timer = setTimeout(send, 2500); else send();
    }
  }

  function values() {
    const v = {};
    const co = $("f-co").value.trim(); if (co) v.co = co;
    fields.forEach((f) => { if (f.value.trim() !== "" && f.value !== f.dataset.default) v[f.dataset.k] = f.dataset.text ? f.value.trim() : f.value.replace(/[\s,]/g, ""); });
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
    track("share_calculation", { tool: "moat" });
  });
  $("reset").addEventListener("click", () => {
    fields.forEach((f) => { f.value = f.dataset.default || ""; });
    $("f-co").value = "";
    form.querySelectorAll("output").forEach((o) => { o.textContent = "–"; o.classList.remove("neg"); });
    render("typing");
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* preview */ }
  });
  $("mt-add").addEventListener("click", () => {
    form.querySelectorAll("tr.mt-more").forEach((tr) => { tr.hidden = false; });
    $("mt-add").hidden = true;
  });
  const q = readQuery();
  if (q.co) $("f-co").value = q.co;
  fields.forEach((f) => { if (q[f.dataset.k] !== undefined) f.value = q[f.dataset.k]; });
  if ([...Array(9)].some((_, i) => q["a" + (i + 6)] !== undefined || q["b" + (i + 6)] !== undefined)) $("mt-add").click();
  render(Object.keys(q).length ? "link" : "typing");
}
