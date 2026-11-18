// Keeps the file's "Xuất/Nhập JSON" box (#dlg / #jt) matched to the latest book content
// while it is open, and adds a "Tải file JSON" button next to it. Plain script inlined in
// the book's <head>; the HTML file itself stays unchanged. `S` is the file's book data.
(function () {
  var last = null; // what the box held after the last fill; differs once the user types
  var note = null;
  var dlBtn = null;
  var stamp = "";

  function el(id) {
    return document.getElementById(id);
  }
  function latest() {
    try {
      return JSON.stringify(S, null, 1);
    } catch (e) {
      return null;
    }
  }
  function now() {
    var d = new Date();
    var p = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  function ensureExtras(dlg, jt) {
    if (!note) {
      note = document.createElement("p");
      note.className = "js-sync-note";
      note.setAttribute("role", "status");
      jt.parentNode.insertBefore(note, jt);
    }
    var dl = el("dl");
    var bar = dlg.querySelector(".bar");
    if (!dlBtn && dl && bar && !dl.classList.contains("hide")) {
      dlBtn = document.createElement("button");
      dlBtn.type = "button";
      dlBtn.className = "js-sync-dl";
      dlBtn.textContent = "Tải file JSON";
      dlBtn.addEventListener("click", function () {
        el("dl").click();
      });
      bar.insertBefore(dlBtn, bar.lastElementChild);
    }
  }

  function sync() {
    var dlg = el("dlg");
    var jt = el("jt");
    if (!dlg || !jt) return;
    if (!dlg.open) {
      last = null;
      return;
    }
    ensureExtras(dlg, jt);
    if (last === null) {
      last = jt.value;
      stamp = now();
    }
    if (jt.value !== last) {
      note.textContent =
        "Bạn đang sửa JSON trong ô này nên ô tạm ngừng tự cập nhật. Bấm Đóng rồi mở lại để lấy bản mới nhất.";
      return;
    }
    var v = latest();
    if (v !== null && v !== jt.value) {
      var top = jt.scrollTop;
      jt.value = v;
      jt.scrollTop = top;
      last = v;
      stamp = now();
    }
    note.textContent = "JSON tự khớp với nội dung mới nhất của sổ · cập nhật lúc " + stamp;
  }

  // Right after the file fills the box on "Xuất/Nhập JSON", remember that fill.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest("#js")) {
      last = null;
      sync();
    }
  });
  var style = document.createElement("style");
  style.textContent =
    ".js-sync-note{font-size:12px;color:var(--mut,#777);margin:4px 0}";
  document.head.appendChild(style);
  setInterval(sync, 1000);
  window.JsonSync = { sync: sync };
})();
