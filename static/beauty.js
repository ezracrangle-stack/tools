// Keynes' beauty contest, the way James Montier plays it: Value Investing (2009), chapter 1.
// Pick a whole number from 0 to 100. The winner is the guess closest to two-thirds of the average.
// summarize() is the same arithmetic as scripts/collect.gs, which closes each monthly round.
import { track } from "./calc.js";

export const MONTIER = { players: "more than 1,000", avg: 26, target: 17, onTarget: 3 };

// Round = calendar month in UTC, e.g. "2026-11".
export function roundOf(d) {
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
export function roundLabel(r) {
  const [y, m] = r.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
export function roundEnd(r) { // last day of the month, as text
  const [y, m] = r.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toLocaleString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export function valid(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n <= 100 ? n : null;
}

// guesses: whole numbers 0-100. Ties share the win.
export function summarize(guesses) {
  const g = guesses.filter((x) => Number.isInteger(x) && x >= 0 && x <= 100);
  const n = g.length;
  if (!n) return { n: 0, avg: null, target: null, win: null, winners: 0, hist: Array(10).fill(0) };
  const avg = g.reduce((a, b) => a + b, 0) / n;
  const target = (2 / 3) * avg;
  const best = Math.min(...g.map((x) => Math.abs(x - target)));
  const wins = [...new Set(g.filter((x) => Math.abs(Math.abs(x - target) - best) < 1e-9))].sort((a, b) => a - b);
  const winners = g.filter((x) => wins.includes(x)).length;
  const hist = Array(10).fill(0);
  g.forEach((x) => { hist[Math.min(9, Math.floor(x / 10))] += 1; });
  return { n, avg, target, win: wins, winners, hist };
}

// Level of thinking: level 0 guesses 50, level 1 two-thirds of that, and so on down to 0.
export const LEVELS = [50, 100 / 3, 200 / 9, 400 / 27, 800 / 81];
export function level(x) {
  if (x === null) return null;
  if (x > 200 / 3) return { k: null, text: "Above 67 can never win: even if everyone picks 100, two-thirds of the average is 67." };
  if (x === 0) return { k: "zero", text: "Zero is the game theorist's answer: two-thirds of zero is still zero. It only wins when everyone else plays it too." };
  if (x > 50) return { k: null, text: "Above 50 wins only if most people pick even higher. Few do." };
  let k = 0, d = Infinity;
  LEVELS.forEach((v, i) => { const di = Math.abs(x - v); if (di < d) { d = di; k = i; } });
  if (x < 7) return { k: 5, text: "Five steps of thinking or more: you expect almost everyone to think it through. Montier found a spike at 1, the economists who know the answer is zero but guess the rest of the world doesn't." };
  const T = [
    "Level 0: 50 is the middle of the range. You picked what an average player would pick, without asking what the others would do.",
    "Level 1: you expect everyone else to pick 50, so you pick two-thirds of 50.",
    "Level 2: you expect everyone else to be one step ahead, at 33, so you pick two-thirds of that.",
    "Level 3: three steps of two-thirds from 50. Most rooms don't go this deep.",
    "Level 4: four steps of two-thirds from 50. You expect a very sharp crowd.",
  ];
  return { k, text: T[k] };
}

// ── Page wiring (browser only) ────────────────────────────────────────────
if (typeof document !== "undefined" && document.getElementById("bcform")) {
  const $ = (id) => document.getElementById(id);
  const collect = document.body.getAttribute("data-collect") || "";
  const now = roundOf(new Date());
  const KEY = "bc-" + now;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  let pid = store.get("bc-id");
  if (!pid) { pid = Math.random().toString(36).slice(2, 12); store.set("bc-id", pid); }

  $("round-name").textContent = roundLabel(now);
  $("round-end").textContent = roundEnd(now);

  const fmt = (x, d = 1) => (x === null ? "–" : x.toFixed(d));

  function showLevel(x) {
    const L = level(x);
    $("x-level").textContent = L ? L.text : "";
    $("x-level").hidden = !L;
  }

  function played(x) {
    $("bcform").hidden = true;
    $("bc-done").hidden = false;
    $("o-mine").textContent = x;
    showLevel(x);
  }

  const prev = store.get(KEY);
  if (prev !== null && valid(prev) !== null) played(valid(prev));

  $("f-guess").addEventListener("input", () => {
    const x = valid($("f-guess").value);
    $("f-guess").setAttribute("aria-invalid", $("f-guess").value && x === null ? "true" : "false");
    $("bc-err").hidden = !($("f-guess").value && x === null);
  });

  $("bcform").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const x = valid($("f-guess").value);
    if (x === null) { $("bc-err").hidden = false; $("f-guess").focus(); return; }
    const payload = { type: "beauty", guess: x, pid, name: $("f-name").value.trim().slice(0, 60),
      publish_ok: $("f-ok").checked && !!$("f-name").value.trim() };
    store.set(KEY, String(x));
    if (collect) {
      fetch(collect, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }).catch(() => {});
    }
    track("beauty_guess", { guess: x });
    played(x);
  });

  function bars(hist) {
    const max = Math.max(1, ...hist);
    return '<div class="bc-hist" aria-hidden="true">' + hist.map((h, i) =>
      `<span class="bc-bar" style="--h:${(100 * h / max).toFixed(1)}%" title="${i * 10}-${i === 9 ? 100 : i * 10 + 9}: ${h}"><i>${i * 10}</i></span>`).join("") + "</div>";
  }

  function renderResults(data) {
    $("o-count").textContent = data.current && data.current.n ? data.current.n : "0";
    const list = (data.rounds || []).slice().sort((a, b) => (a.round < b.round ? 1 : -1));
    if (!list.length) { $("bc-past").innerHTML = '<p class="hint">The first round closes at the end of ' + roundEnd(now) + ". Results show here the next day.</p>"; return; }
    $("bc-past").innerHTML = list.map((r) => {
      const who = r.names && r.names.length ? " Won by " + r.names.join(", ") + (r.winners > r.names.length ? " and " + (r.winners - r.names.length) + " more" : "") + "." : "";
      return `<div class="bc-round"><p class="hsub">${roundLabel(r.round)}</p>
        <div class="sheet">
        <div class="srow calc-row"><span class="lab">Guesses</span><output class="cell">${r.n}</output></div>
        <div class="srow calc-row"><span class="lab">Average</span><output class="cell">${fmt(r.avg)}</output></div>
        <div class="srow calc-row total"><span class="lab">Two-thirds of the average</span><output class="cell">${fmt(r.target)}</output></div>
        <div class="srow calc-row"><span class="lab">Winning guess</span><output class="cell">${r.win ? r.win.join(" and ") : "–"}</output></div>
        </div>${bars(r.hist || [])}<p class="hint">${r.winners} ${r.winners === 1 ? "person" : "people"} picked it.${who}</p></div>`;
    }).join("");
  }

  if (collect) {
    fetch(collect + "?game=beauty").then((r) => r.json()).then(renderResults).catch(() => {
      $("bc-past").innerHTML = '<p class="hint">Results couldn\'t load. Try again later.</p>';
    });
  }
}
