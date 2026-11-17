// Box view for the case-detail tab ("Chi tiết án"). Plain browser script injected into the
// book's <head> as text (imported with ?raw), so it must stay dependency-free ES5-ish code.
// It never touches the file's code: each boxed field's original text cell is hidden, the boxes
// are drawn next to it, and every edit is written back into that cell followed by an `input`
// event, so the file's own handler stores it in S and saves.
(function () {
  "use strict";
  var FIELDS = {
    ds: { mode: "table", cols: ["Tên", "Vai trò", "Xuất hiện"], color: "#7f77dd", unit: "nhân vật" },
    mv: { mode: "table", tag: true, cols: ["Nội dung", "Ai giao", "Điều kiện", "Thưởng hoặc hậu quả"], color: "#378add", unit: "nhiệm vụ" },
    npc: { def: "semi", color: "#7f77dd", unit: "nhân vật" },
    nv: { def: "dash", color: "#378add", unit: "nhiệm vụ" },
    mm: { def: "semi", color: "#ba7517", unit: "manh mối" },
    vc: { def: "dash", color: "#ba7517", unit: "vật chứng" },
    lu: { def: "dash", color: "#d85a30", unit: "lưu ý" }
  };
  var TAGS = [["chính", "#378add"], ["phụ", "#1d9e75"], ["ẩn", "#7f77dd"], ["theo vai", "#ba7517"]];

  function trimAll(a) { return a.map(function (s) { return s.trim(); }); }
  function oneLine(s) { return String(s == null ? "" : s).replace(/\u00a0/g, " ").replace(/\s*\n+\s*/g, " ").trim(); }

  // ---- text <-> boxes -------------------------------------------------------------------
  function parse(text, field) {
    var f = FIELDS[field] || { def: "para" }, t = String(text == null ? "" : text).replace(/\r/g, "");
    if (f.mode === "table") return parseTable(t, f);
    var mode = f.def;
    if (/^\s*[-•]\s/m.test(t)) mode = "dash";
    else if (f.def !== "para" && t.indexOf(";") >= 0) mode = "semi";
    if (mode === "dash") return parseDash(t);
    if (mode === "semi") return parseSemi(t);
    return parsePara(t);
  }

  function parseTable(t, f) {
    var n = f.cols.length, rows = [];
    t.split("\n").forEach(function (line) {
      if (!line.trim()) return;
      var p = trimAll(line.split("|")), tag = "";
      if (f.tag) { var m = /^\[([^\]]*)\]\s*/.exec(p[0]); if (m) { tag = m[1].trim(); p[0] = p[0].slice(m[0].length); } }
      if (p.length > n) p = p.slice(0, n - 1).concat([p.slice(n - 1).filter(Boolean).join(" / ")]);
      while (p.length < n) p.push("");
      rows.push({ tag: tag, f: p });
    });
    return { mode: "table", tag: !!f.tag, rows: rows };
  }

  // Blank lines between groups are kept so an untouched field reads back exactly the same.
  function gap(t) { return /\n\s*\n/.test(t.trim()) ? "\n\n" : "\n"; }

  function parseDash(t) {
    var groups = [], cur = null;
    function into() { if (!cur) { cur = { t: null, items: [] }; groups.push(cur); } return cur; }
    t.split("\n").forEach(function (line) {
      var s = line.trim(); if (!s) return;
      var m = /^[-•]\s*(.*)$/.exec(s);
      if (m) into().items.push(m[1]);
      else if (/:$/.test(s)) { cur = { t: s.slice(0, -1).trim(), items: [] }; groups.push(cur); }
      else into().items.push(s);
    });
    return { mode: "dash", sep: gap(t), groups: groups };
  }

  function parseSemi(t) {
    var groups = [];
    t.split("\n").forEach(function (line) {
      var s = line.trim(); if (!s) return;
      var dot = /\.$/.test(s) && !/\.\.$/.test(s);
      if (dot) s = s.slice(0, -1);
      var m = /^([^;:]{1,60}):\s+/.exec(s), title = null;
      if (m) { title = m[1].trim(); s = s.slice(m[0].length); }
      groups.push({ t: title, dot: dot, items: trimAll(s.split(";")).filter(Boolean) });
    });
    return { mode: "semi", sep: gap(t), groups: groups };
  }

  function parsePara(t) {
    var blank = /\n\s*\n/.test(t);
    var items = trimAll(t.split(blank ? /\n\s*\n/ : /\n/)).filter(Boolean);
    return { mode: "para", sep: blank ? "\n\n" : "\n", groups: [{ t: null, items: items }] };
  }

  function serialize(m) {
    if (m.mode === "table") {
      return m.rows.map(function (r) {
        var f = r.f.map(function (x) { return oneLine(x).replace(/\|/g, "/"); });
        while (f.length > 1 && !f[f.length - 1]) f.pop();
        var s = f.join(" | "), tag = m.tag ? oneLine(r.tag).replace(/[\[\]]/g, "") : "";
        if (!s && !tag) return "";
        return tag ? "[" + tag + "] " + s : s;
      }).filter(Boolean).join("\n");
    }
    if (m.mode === "dash") {
      return m.groups.map(function (g) {
        var out = [], t = g.t == null ? "" : oneLine(g.t).replace(/:+$/, "");
        if (t) out.push(t + ":");
        g.items.map(oneLine).filter(Boolean).forEach(function (i) { out.push("- " + i); });
        return out.join("\n");
      }).filter(Boolean).join(m.sep || "\n");
    }
    if (m.mode === "semi") {
      return m.groups.map(function (g) {
        var it = g.items.map(oneLine).filter(Boolean), t = g.t == null ? "" : oneLine(g.t).replace(/:+$/, "");
        if (!it.length) return t ? t + ":" : "";
        return (t ? t + ": " : "") + it.join("; ") + (g.dot ? "." : "");
      }).filter(Boolean).join(m.sep || "\n");
    }
    var items = m.groups[0].items.map(function (s) { return String(s).replace(/\u00a0/g, " ").trim(); }).filter(Boolean);
    var sep = m.sep === "\n" && items.some(function (s) { return s.indexOf("\n") >= 0; }) ? "\n\n" : m.sep;
    return items.join(sep);
  }

  window.CaseBoxCodec = { parse: parse, serialize: serialize, FIELDS: FIELDS };
  if (typeof document === "undefined" || !document.addEventListener) return;

  // ---- drawing --------------------------------------------------------------------------
  var RO = !!window.__cbRO, textMode = {};
  var CE = RO ? "" : ' contenteditable="true"';
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function tagColor(tag, def) {
    var l = String(tag || "").toLowerCase();
    for (var i = 0; i < TAGS.length; i++) if (l.indexOf(TAGS[i][0]) === 0) return TAGS[i][1];
    return def;
  }
  function tools(at) {
    if (RO) return "";
    return '<span class="cb-tl"><button type="button" data-cb-act="up" data-cb-at="' + at + '" title="Lên">↑</button>' +
      '<button type="button" data-cb-act="down" data-cb-at="' + at + '" title="Xuống">↓</button>' +
      '<button type="button" class="cb-del" data-cb-act="del" data-cb-at="' + at + '" title="Xóa ô">×</button></span>';
  }
  function count(m) {
    if (m.mode === "table") return m.rows.length;
    return m.groups.reduce(function (n, g) { return n + g.items.length; }, 0);
  }

  function draw(box, keep) {
    var k = box._k, f = FIELDS[k], src = box._src, h;
    if (textMode[k]) {
      src.classList.remove("cb-src");
      box.innerHTML = '<div class="cb-bar"><span></span><button type="button" class="cb-sw" data-cb-act="sw">Xem dạng ô</button></div>';
      return;
    }
    src.classList.add("cb-src");
    var m = box._m = keep || parse(sourceText(box), k);
    h = '<div class="cb-bar"><span class="cb-c">' + count(m) + " " + f.unit + '</span><button type="button" class="cb-sw" data-cb-act="sw">Sửa dạng chữ</button></div>';
    if (m.mode === "table") {
      h += '<div class="cb-grid">' + m.rows.map(function (r, i) {
        var head = m.tag
          ? '<span class="cb-tag"' + CE + ' data-cb-p="r.' + i + '.tag" data-ph="Loại">' + esc(r.tag) + "</span>"
          : "";
        var rest = f.cols.map(function (c, j) {
          if (j === 0) return "";
          return '<div class="cb-l">' + esc(c) + '</div><div class="cb-v"' + CE + ' data-cb-p="r.' + i + ".f." + j + '" data-ph="(trống)">' + esc(r.f[j]) + "</div>";
        }).join("");
        return '<div class="cb-box" style="--k:' + (m.tag ? tagColor(r.tag, f.color) : f.color) + '"><div class="cb-hd">' + head +
          (m.tag ? '<span class="cb-sp"></span>' + tools("r." + i) + '</div><div class="cb-t cb-tl1"' + CE + ' data-cb-p="r.' + i + '.f.0" data-ph="' + esc(f.cols[0]) + '">' + esc(r.f[0]) + "</div>"
            : '<div class="cb-t"' + CE + ' data-cb-p="r.' + i + '.f.0" data-ph="' + esc(f.cols[0]) + '">' + esc(r.f[0]) + "</div>" + tools("r." + i) + "</div>") +
          rest + "</div>";
      }).join("") + "</div>";
      if (!RO) h += '<button type="button" class="cb-add" data-cb-act="addr">+ Thêm ' + f.unit + "</button>";
    } else {
      h += m.groups.map(function (g, gi) {
        var title = g.t == null ? "" : '<div class="cb-gt"' + CE + ' data-cb-p="g.' + gi + '.t" data-ph="Tên nhóm (có thể để trống)">' + esc(g.t) + "</div>";
        return '<div class="cb-g">' + title + '<div class="cb-grid">' + g.items.map(function (it, ii) {
          return '<div class="cb-box cb-it" style="--k:' + f.color + '"><div class="cb-hd"><span class="cb-n">' + (ii + 1) + '</span><div class="cb-v cb-grow"' + CE +
            ' data-cb-p="g.' + gi + ".i." + ii + '" data-ph="(trống)">' + esc(it) + "</div>" + tools("g." + gi + "." + ii) + "</div></div>";
        }).join("") + "</div>" + (RO ? "" : '<button type="button" class="cb-add" data-cb-act="addi" data-cb-at="' + gi + '">+ Thêm ' + f.unit + "</button>") + "</div>";
      }).join("");
      if (!m.groups.length && !RO) h += '<button type="button" class="cb-add" data-cb-act="addi" data-cb-at="0">+ Thêm ' + f.unit + "</button>";
      if (!RO && m.mode !== "para") h += '<button type="button" class="cb-add cb-addg" data-cb-act="addg">+ Thêm nhóm</button>';
    }
    if (RO && !count(m)) h += '<div class="cb-c">(chưa có)</div>';
    box.innerHTML = h;
  }

  // The case object in S is the source of truth; the cell's innerText is empty while it
  // sits inside a closed <details>.
  function sourceText(box) {
    var c = curCase();
    if (c && typeof c[box._k] === "string") return c[box._k];
    return box._src.innerText;
  }

  function write(box) {
    var src = box._src, text = serialize(box._m);
    if (src.textContent !== text) {
      src.textContent = text;
      if (box._k === "lu") storeNote(text);
      else src.dispatchEvent(new Event("input", { bubbles: true }));
    }
    var c = box.querySelector(".cb-c");
    if (c) c.textContent = count(box._m) + " " + FIELDS[box._k].unit;
  }

  // "Lưu ý" is a field the file does not know about: it lives in S.cases[cur].lu and is saved
  // through the file's own save(). S, cur and save are the file's top-level bindings.
  function curCase() {
    try { return S.cases[cur] || null; } catch (_) { return null; }
  }
  function storeNote(text) {
    var c = curCase(); if (!c) return;
    c.lu = text;
    try { save(); } catch (_) {}
  }
  function addNoteSection(am) {
    if (am.querySelector(".cb-lu")) return;
    var ghi = am.querySelector('.txt[data-af="ghi"]'), c = curCase();
    if (!ghi || !c) return;
    var h = document.createElement("h3");
    h.className = "sc cb-lu";
    h.textContent = "Lưu ý";
    var src = document.createElement("div");
    src.className = "txt";
    src.setAttribute("data-cb-lu", "1");
    if (!RO) src.setAttribute("contenteditable", "true");
    src.textContent = c.lu || "";
    ghi.parentNode.insertBefore(src, ghi.nextSibling);
    ghi.parentNode.insertBefore(h, src);
  }

  function focusAt(box, p) {
    var el = box.querySelector('[data-cb-p="' + p + '"]');
    if (el) { el.focus(); el.scrollIntoView({ block: "nearest" }); }
  }

  function enhance() {
    var am = document.getElementById("am");
    if (!am) return;
    addNoteSection(am);
    var cells = am.querySelectorAll(".txt[data-af], .txt[data-cb-lu]");
    for (var i = 0; i < cells.length; i++) {
      var src = cells[i], k = src.getAttribute("data-af") || "lu";
      if (!FIELDS[k] || src._cb) continue;
      src._cb = true;
      var box = document.createElement("div");
      box.className = "cb";
      box._src = src; box._k = k;
      src.parentNode.insertBefore(box, src);
      draw(box);
    }
  }

  function onInput(e) {
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-cb-lu")) { storeNote(t.innerText); return; }
    var p = t && t.getAttribute && t.getAttribute("data-cb-p");
    if (!p) return;
    var box = t.closest(".cb"); if (!box || !box._m) return;
    var m = box._m, a = p.split("."), v = t.innerText.replace(/\n$/, "");
    if (a[0] === "r") { var r = m.rows[+a[1]]; if (a[2] === "tag") { r.tag = v; var b = t.closest(".cb-box"); if (b) b.style.setProperty("--k", tagColor(v, FIELDS[box._k].color)); } else r.f[+a[3]] = v; }
    else if (a[2] === "t") m.groups[+a[1]].t = v;
    else m.groups[+a[1]].items[+a[3]] = v;
    write(box);
  }

  function onClick(e) {
    var btn = e.target.closest && e.target.closest("[data-cb-act]");
    if (!btn) return;
    var box = btn.closest(".cb"); if (!box) return;
    var act = btn.getAttribute("data-cb-act"), at = (btn.getAttribute("data-cb-at") || "").split("."), m = box._m, f = FIELDS[box._k], focus = null;
    if (act === "sw") { if (!textMode[box._k] && document.activeElement) document.activeElement.blur(); textMode[box._k] = !textMode[box._k]; draw(box); return; }
    if (RO || !m) return;
    if (act === "addr") { m.rows.push({ tag: "", f: f.cols.map(function () { return ""; }) }); focus = "r." + (m.rows.length - 1) + (m.tag ? ".tag" : ".f.0"); }
    else if (act === "addi") { if (!m.groups.length) m.groups.push({ t: null, dot: false, items: [] }); var g = m.groups[+at[0]]; g.items.push(""); focus = "g." + at[0] + ".i." + (g.items.length - 1); }
    else if (act === "addg") { var last = m.groups[m.groups.length - 1]; m.groups.push({ t: "", dot: last ? last.dot : false, items: [""] }); focus = "g." + (m.groups.length - 1) + ".t"; }
    else {
      var list = at[0] === "r" ? m.rows : m.groups[+at[1]].items, i = +(at[0] === "r" ? at[1] : at[2]);
      if (act === "del") { if (!confirm("Xóa ô này?")) return; list.splice(i, 1); if (at[0] === "g" && !list.length && m.mode !== "para") m.groups.splice(+at[1], 1); }
      else { var j = i + (act === "up" ? -1 : 1); if (j < 0 || j >= list.length) return; var x = list[i]; list[i] = list[j]; list[j] = x; }
    }
    write(box);
    // Keep the in-memory model so freshly added empty boxes stay on screen.
    draw(box, m);
    if (focus) focusAt(box, focus);
  }

  function onKey(e) {
    if (e.key !== "Enter") return;
    var t = e.target, p = t && t.getAttribute && t.getAttribute("data-cb-p");
    if (!p) return;
    var box = t.closest(".cb");
    if (box && box._m && box._m.mode === "para" && p.indexOf(".i.") > 0) return;
    e.preventDefault();
    t.blur();
  }

  var css = ".cb{margin:2px 0 6px}.cb-src{display:none!important}" +
    ".cb-bar{display:flex;align-items:center;gap:8px;justify-content:space-between;margin:0 0 6px}.cb-c{font-size:12px;color:var(--mut)}" +
    ".cb-sw{font-size:12px;color:var(--mut);background:none;border:0;padding:2px 0;text-decoration:underline;text-underline-offset:2px}" +
    ".cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}" +
    ".cb-box{background:var(--bg);border:1px solid var(--bd);border-top:3px solid var(--k);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}" +
    ".cb-it{padding:7px 9px}.cb-hd{display:flex;gap:6px;align-items:flex-start}.cb-sp{flex:1}" +
    ".cb-t{flex:1;font-weight:600;outline:0;min-width:0;overflow-wrap:anywhere;line-height:1.45}.cb-tl1{font-weight:500}" +
    ".cb-tag{font-size:12px;font-weight:600;color:var(--k);border:1.5px solid var(--k);border-radius:99px;padding:0 9px;outline:0;min-width:3em;line-height:1.6}" +
    ".cb-l{font-size:11px;color:var(--mut);margin-top:4px;text-transform:uppercase;letter-spacing:.03em}" +
    ".cb-v{outline:0;white-space:pre-wrap;line-height:1.5;min-height:1.5em;overflow-wrap:anywhere}.cb-grow{flex:1;min-width:0}" +
    ".cb-n{font-size:11px;color:var(--k);font-weight:700;min-width:1.4em;padding-top:3px}" +
    "[contenteditable].cb-v:focus,[contenteditable].cb-t:focus,[contenteditable].cb-gt:focus,[contenteditable].cb-tag:focus{background:var(--pn);box-shadow:0 0 0 2px var(--pn),0 0 0 3px var(--k,#378add);border-radius:4px}" +
    ".cb-v:empty:before,.cb-t:empty:before,.cb-gt:empty:before,.cb-tag:empty:before{content:attr(data-ph);color:var(--mut);font-weight:400}" +
    ".cb-g{margin:6px 0 10px}.cb-gt{font-size:13px;font-weight:600;margin:4px 0 6px;outline:0;padding-left:2px}" +
    ".cb-tl{display:flex;gap:2px;opacity:.55;flex-shrink:0}.cb-box:hover .cb-tl,.cb-box:focus-within .cb-tl{opacity:1}" +
    ".cb-tl button{font-size:12px;line-height:1;padding:3px 6px;border-color:transparent;background:none;color:var(--mut)}.cb-tl button:hover{border-color:var(--bd);color:var(--fg)}.cb-tl .cb-del:hover{color:#e24b4a}" +
    ".cb-add{margin-top:8px;font-size:12px;border-style:dashed;color:var(--mut);background:none}.cb-add:hover{color:var(--fg)}.cb-addg{display:block}" +
    "@media (max-width:640px){.cb-grid{grid-template-columns:1fr}}" +
    "@media (pointer:coarse){.cb-tl{opacity:1}.cb-tl button{padding:6px 9px;font-size:14px}.cb-add{min-height:34px}}";

  function start() {
    var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
    document.addEventListener("input", onInput);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    var am = document.getElementById("am");
    if (!am) return;
    enhance();
    new MutationObserver(enhance).observe(am, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
