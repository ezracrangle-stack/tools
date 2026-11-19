// Shared bar under every calculator: share on X / LinkedIn, download PDF or CSV,
// send the calculation to Ezra, and the testimonial form. No tool math here.
(function () {
  var form = document.querySelector("form.calc");
  var bar = document.getElementById("sharebar");
  var collect = document.body.getAttribute("data-collect") || "";
  function track(name, params) { if (typeof gtag === "function") gtag("event", name, params || {}); }
  var slug = location.pathname.replace(/^\/|\/$/g, "") || "home";
  var title = (document.querySelector("h1.page-title") || {}).textContent || document.title;
  var toolName = document.body.getAttribute("data-tool-name") || title;

  // Every field on the page goes into the link, so it opens with the same numbers.
  function query() {
    var p = new URLSearchParams();
    ["cur", "u", "su"].forEach(function (id) { var el = document.getElementById(id); if (el) p.set(id, el.value); });
    form.querySelectorAll("select[data-choice]").forEach(function (s) { p.set(s.getAttribute("data-choice"), s.value); });
    form.querySelectorAll("input[data-k], input[data-h]").forEach(function (f) {
      var k = f.getAttribute("data-k") || f.getAttribute("data-h");
      var v = f.value.trim().replace(/[\s,]/g, "");
      if (v !== "" && v !== f.getAttribute("data-default")) p.set(k, v);
    });
    return p;
  }
  function link() {
    var base = typeof window.calcLink === "function" ? window.calcLink() : location.origin + location.pathname + "?" + query().toString();
    var u = new URL(base);
    if (company()) u.searchParams.set("co", company()); else u.searchParams.delete("co");
    return u.toString();
  }
  function company() { var c = document.getElementById("sb-company"); return c ? c.value.trim() : ""; }
  function verdictText() { var v = document.getElementById("verdict"); return v ? v.innerText.replace(/\s+/g, " ").trim() : ""; }

  // Rows of the worksheet, in page order, for the CSV.
  function rows() {
    var out = [["Section", "Item", "Value", "Second value"]], section = "";
    var clean = function (el) { return el ? (el.value !== undefined && el.tagName !== "OUTPUT" ? el.value : el.textContent).replace(/\s+/g, " ").trim() : ""; };
    form.querySelectorAll(".srow, table.grid tr, .profile tr").forEach(function (r) {
      if (r.classList.contains("head")) { section = r.textContent.replace(/\s+/g, " ").trim(); return; }
      if (r.classList.contains("note")) return;
      if (r.tagName === "TR") {
        var cells = [].slice.call(r.children).map(function (c) { var i = c.querySelector("input,output,select"); return i ? clean(i) : c.textContent.replace(/\s+/g, " ").trim(); });
        if (cells.some(function (c) { return c !== ""; })) out.push([section].concat(cells));
        return;
      }
      var lab = r.querySelector(".lab, label, span.lab");
      var name = lab ? lab.childNodes[0] && lab.childNodes[0].textContent ? lab.childNodes[0].textContent.trim() : lab.textContent.trim() : "";
      if (blank(r)) return;
      var vals = [].slice.call(r.querySelectorAll("input:not([hidden]):not(.sr), select, output")).filter(function (e) { return e.offsetParent !== null; }).map(clean);
      if (name) out.push([section, name].concat(vals));
    });
    out.push([]);
    out.push(["Result", verdictText()]);
    out.push(["Link", link()]);
    out.push(["Made with", "tools.ezrasnotes.com (free value investing calculators by Ezra's Notes). Education only, not investment advice."]);
    return out;
  }
  function csv() {
    return rows().map(function (r) { return r.map(function (c) { c = String(c == null ? "" : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\n");
  }
  function download(name, text, type) {
    var blob = new Blob(["﻿" + text], { type: type });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function fileBase() { return (slug + (company() ? "-" + company() : "") + "-" + (function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })(new Date())).replace(/[^A-Za-z0-9._-]+/g, "-"); }

  // For the PDF: drop rows with nothing in them, and put the result at the top.
  function blank(r) {
    var els = [].slice.call(r.querySelectorAll("input:not(.sr), select, output"));
    if (!els.length) return false;
    return els.every(function (e) { var v = (e.tagName === "OUTPUT" ? e.textContent : e.value).trim(); return v === "" || v === "–" || v === "-" || v === "n/m"; });
  }
  function prepPrint() {
    var groups = [], cur = null;
    form.querySelectorAll(".srow").forEach(function (r) {
      if (r.classList.contains("head")) { cur = { head: r, rows: [] }; groups.push(cur); return; }
      if (cur) cur.rows.push(r);
      if (blank(r)) r.classList.add("print-skip");
    });
    groups.forEach(function (g) {
      var data = g.rows.filter(function (r) { return r.querySelector("input:not(.sr), select, output"); });
      if (data.length && data.every(function (r) { return r.classList.contains("print-skip"); })) {
        g.head.classList.add("print-skip"); g.rows.forEach(function (r) { r.classList.add("print-skip"); });
      }
    });
    var sum = document.getElementById("print-summary"), v = document.getElementById("verdict");
    var lede = document.querySelector(".lede");
    if (sum && lede) lede.after(sum);
    if (sum && v) sum.innerHTML = v.innerHTML;
  }
  window.addEventListener("afterprint", function () {
    document.querySelectorAll(".print-skip").forEach(function (r) { r.classList.remove("print-skip"); });
    var sum = document.getElementById("print-summary"); if (sum) sum.innerHTML = "";
  });

  if (bar && form) {
    var co = document.getElementById("sb-company");
    var q = new URLSearchParams(location.search);
    if (co && q.get("co")) co.value = q.get("co");
    document.getElementById("sb-x").addEventListener("click", function () {
      var text = "Ran the numbers" + (company() ? " on " + company() : "") + " with " + toolName + ", one of the free value investing tools by @ezracrangle";
      window.open("https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(link()), "_blank", "noopener");
      track("share", { method: "x", tool: slug });
    });
    document.getElementById("sb-in").addEventListener("click", function () {
      window.open("https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(link()), "_blank", "noopener");
      track("share", { method: "linkedin", tool: slug });
    });
    var nat = document.getElementById("sb-native");
    if (navigator.share) {
      nat.hidden = false;
      nat.addEventListener("click", function () {
        navigator.share({ title: title + " · Ezra's Notes", text: "Ran the numbers" + (company() ? " on " + company() : "") + " with " + toolName, url: link() })
          .then(function () { track("share", { method: "native", tool: slug }); }).catch(function () {});
      });
    }
    document.getElementById("sb-pdf").addEventListener("click", function () {
      var stamp = document.getElementById("print-stamp");
      if (stamp) stamp.textContent = (company() ? company() + " · " : "") + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) + " · " + link();
      track("download", { format: "pdf", tool: slug });
      prepPrint();
      window.print();
    });
    document.getElementById("sb-csv").addEventListener("click", function () {
      download(fileBase() + ".csv", csv(), "text/csv;charset=utf-8");
      track("download", { format: "csv", tool: slug });
    });

    // Send to Ezra (private sheet). Shown only when the collection endpoint is set.
    var saveBtn = document.getElementById("sb-save"), saveBox = document.getElementById("sb-savebox");
    var tmBox = document.getElementById("testimonial");
    if (collect && saveBtn) {
      bar.querySelector(".sb-community").hidden = false;
      document.getElementById("sb-tm").addEventListener("click", function () { tmBox.hidden = !tmBox.hidden; saveBox.hidden = true; if (!tmBox.hidden) document.getElementById("tm-text").focus(); });
      var opened = 0;
      saveBtn.addEventListener("click", function () { saveBox.hidden = !saveBox.hidden; tmBox.hidden = true; opened = Date.now(); });
      document.getElementById("sb-send").addEventListener("click", function () {
        var st = document.getElementById("sb-status");
        if (document.getElementById("sb-hp").value) return;
        if (/^Fill in the fields/.test(verdictText())) { st.textContent = "Fill in the calculator first, then send it."; return; }
        if (Date.now() - opened < 1500) { st.textContent = "One more second, then try again."; return; }
        var payload = { type: "calculation", tool: slug, title: title, company: company(),
          name: document.getElementById("sb-name").value.trim(), publish_ok: document.getElementById("sb-ok").checked,
          result: verdictText(), link: link(), page_time: new Date().toISOString() };
        st.textContent = "Sending…";
        fetch(collect, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
          .then(function () { st.textContent = "Sent. Thank you!"; document.getElementById("sb-send").disabled = true; track("save_calculation", { tool: slug }); })
          .catch(function () { st.textContent = "It didn't go through. Check your connection and try again."; });
      });
    }
  }

  // Testimonial form (any page). Shown only when the collection endpoint is set.
  var tbox = document.getElementById("testimonial");
  if (tbox && collect) {
    var t0 = Date.now();
    document.getElementById("tm-send").addEventListener("click", function () {
      var st = document.getElementById("tm-status"), text = document.getElementById("tm-text").value.trim();
      if (document.getElementById("tm-hp").value) return;
      if (text.length < 10) { st.textContent = "Write a few words first."; return; }
      if (Date.now() - t0 < 3000) { st.textContent = "One more second, then try again."; return; }
      var payload = { type: "testimonial", tool: slug, name: document.getElementById("tm-name").value.trim(),
        handle: document.getElementById("tm-handle").value.trim(), role: document.getElementById("tm-role").value.trim(),
        text: text, publish_ok: document.getElementById("tm-ok").checked, page_time: new Date().toISOString() };
      st.textContent = "Sending…";
      fetch(collect, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
        .then(function () { st.textContent = "Thank you! It means a lot."; document.getElementById("tm-send").disabled = true; track("testimonial", { tool: slug }); })
        .catch(function () { st.textContent = "It didn't go through. Check your connection and try again."; });
    });
  }
})();
