'use strict';
// Startup safety net: if the app does not finish starting (for example because of old cached
// files), a bar with a Repair button appears instead of leaving the app half loaded.
(function () {
  var shown = false;
  function repair() {
    var jobs = [];
    try { if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })); } catch (e) { /* nada */ }
    try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })); } catch (e) { /* nada */ }
    Promise.all(jobs).catch(function () {}).then(function () { location.reload(); });
  }
  function bar(msg) {
    if (shown || !document.body) return;
    shown = true;
    var d = document.createElement('div');
    d.id = 'cc-recover';
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 14px;background:#7c2d12;color:#fff;font:14px system-ui,sans-serif';
    var t = document.createElement('span');
    t.textContent = msg;
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Repair and reload';
    b.style.cssText = 'padding:8px 14px;border:0;border-radius:6px;background:#fff;color:#7c2d12;font-weight:600;cursor:pointer';
    b.onclick = repair;
    var c = document.createElement('button');
    c.type = 'button';
    c.textContent = 'Close';
    c.style.cssText = 'padding:8px 10px;border:1px solid #fff;border-radius:6px;background:none;color:#fff;cursor:pointer';
    c.onclick = function () { d.remove(); };
    d.appendChild(t); d.appendChild(b); d.appendChild(c);
    document.body.appendChild(d);
  }
  window.addEventListener('error', function (e) {
    if (!window.__ccReady && e && e.filename && /app\.js|boot\.js/.test(e.filename)) bar('CodeCraft could not start properly (' + (e.message || 'error') + ').');
  });
  setTimeout(function () {
    if (!window.__ccReady) bar('CodeCraft took too long to start. Press Repair (it does not delete your files).');
  }, 5000);
})();
