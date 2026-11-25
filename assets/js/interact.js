/* SS Gulf Shipping: sitewide interaction layer (vanilla JS, no dependencies).
   Route planner, container builder, scroll-spy, progress bar, magnetic buttons, cursor spotlight,
   live office clocks, click-to-copy and contact-form pre-fill. Everything degrades to the plain page. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = root.classList.contains('reduce');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || d).querySelectorAll(s)); };
  var emit = function (name, detail) { window.dispatchEvent(new CustomEvent(name, { detail: detail })); };

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = d.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); d.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  }

  /* ---------- scroll progress bar ---------- */
  var bar = d.createElement('div'); bar.className = 'scrollbar'; bar.setAttribute('aria-hidden', 'true'); d.body.appendChild(bar);
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var h = root.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0).toFixed(4) + ')';
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- magnetic buttons + cursor spotlight (mouse / trackpad only) ---------- */
  if (fine && !reduce) {
    $$('.btn, .callchip').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(1) + 'px');
        el.style.setProperty('--my', (((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
    });
    $$('.sec--navy, .sec--navy2, .ftr').forEach(function (s) {
      s.addEventListener('pointermove', function (e) {
        var r = s.getBoundingClientRect();
        s.style.setProperty('--sx', (e.clientX - r.left) + 'px'); s.style.setProperty('--sy', (e.clientY - r.top) + 'px');
        s.classList.add('spot-live');
      });
      s.addEventListener('pointerleave', function () { s.classList.remove('spot-live'); });
    });
  }

  /* ---------- scroll-spy for the services sub-navigation ---------- */
  var sub = $('.subnav');
  if (sub && 'IntersectionObserver' in window) {
    root.style.scrollPaddingTop = '156px';
    var links = $$('a[href^="#"]', sub), targets = links.map(function (a) { return $(a.getAttribute('href')); });
    var current = null;
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) current = en.target; });
      links.forEach(function (a, i) { a.setAttribute('aria-current', targets[i] === current ? 'true' : 'false'); });
      var act = links.filter(function (a) { return a.getAttribute('aria-current') === 'true'; })[0];
      if (act && sub.firstElementChild && sub.firstElementChild.scrollWidth > sub.firstElementChild.clientWidth) act.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, { rootMargin: '-35% 0px -55% 0px' });
    targets.forEach(function (t) { if (t) spy.observe(t); });
  }

  /* ---------- live office clocks ---------- */
  var clocks = $$('[data-tz]');
  if (clocks.length) {
    var fmt = {};
    var tick = function () {
      clocks.forEach(function (c) {
        var tz = c.getAttribute('data-tz');
        try { fmt[tz] = fmt[tz] || new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }); c.textContent = fmt[tz].format(new Date()); }
        catch (e) { c.textContent = '--:--'; }
      });
    };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- click to copy ---------- */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var done = function () { toast('Copied: ' + text); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
      function fallback() { var t = d.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; d.body.appendChild(t); t.select(); try { d.execCommand('copy'); done(); } catch (e) { toast('Press Ctrl+C to copy: ' + text); } t.remove(); }
    });
  });

  /* ---------- route planner (drives the 3D globe) ---------- */
  var pl = $('#planner');
  if (pl) {
    var ports = JSON.parse(pl.getAttribute('data-ports'));
    var from = $('#pl-from'), to = $('#pl-to'), svc = $('#pl-service'), out = $('#pl-route'), dist = $('#pl-dist'), cta = $('#pl-cta');
    var find = function (n) { return ports.filter(function (p) { return p.n === n; })[0]; };
    var km = function (a, b) {
      var t = Math.PI / 180, R = 6371, dLa = (b.la - a.la) * t, dLo = (b.lo - a.lo) * t;
      var h = Math.pow(Math.sin(dLa / 2), 2) + Math.cos(a.la * t) * Math.cos(b.la * t) * Math.pow(Math.sin(dLo / 2), 2);
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    var update = function () {
      var A = find(from.value), B = find(to.value), parts = svc.value.split('|'), sName = parts[0], sDetail = parts[1] || '';
      var label = svc.options[svc.selectedIndex].text;
      if (A && B && A === B) { out.textContent = 'Choose two different ports'; dist.textContent = ''; }
      else if (A && B) { out.textContent = A.n + ' → ' + B.n; dist.textContent = '≈ ' + Math.round(km(A, B)).toLocaleString('en-US') + ' km straight-line · ' + label; }
      else { out.textContent = (A ? A.n : 'Origin') + ' → ' + (B ? B.n : 'Destination'); dist.textContent = 'Tell us the rest of the route in your quote request · ' + label; }
      var q = new URLSearchParams(); if (from.value) q.set('from', from.value); if (to.value) q.set('to', to.value); q.set('service', sName); if (sDetail) q.set('detail', sDetail);
      if (A && B && A !== B) q.set('km', String(Math.round(km(A, B))));
      cta.href = 'contact.html?' + q.toString() + '#contact-form';
      var detail = { from: from.value, to: to.value };
      window.__lastRoute = detail; emit('globe:route', detail);
      $$('.ports li').forEach(function (li) { var n = li.querySelector('b'); n = n && n.textContent; li.classList.toggle('is-from', n === from.value); li.classList.toggle('is-to', n === to.value && to.value !== from.value); });
    };
    from.value = 'Karachi'; to.value = 'Jebel Ali';
    [from, to, svc].forEach(function (el) { el.addEventListener('change', update); });
    $('#pl-swap').addEventListener('click', function () { var t = from.value; from.value = to.value; to.value = t; update(); });
    var choose = function (name) {
      if (!find(name)) return;
      if (name === from.value) { var t = to.value; to.value = name; from.value = t; } else to.value = name;
      update(); toast('Destination: ' + name);
    };
    window.addEventListener('port:select', function (e) { choose(e.detail.name); });
    $$('.ports li').forEach(function (li) {
      var n = li.querySelector('b'); if (!n) return; var name = n.textContent;
      li.setAttribute('role', 'button'); li.tabIndex = 0; li.setAttribute('aria-label', 'Set ' + name + ' as destination');
      li.addEventListener('click', function () { choose(name); });
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(name); } });
    });
    update();
  }

  /* ---------- container builder (drives the 3D container) ---------- */
  var cfg = $('#cfg');
  if (cfg) {
    var sum = $('#cfg-sum'), ccta = $('#cfg-cta');
    var read = function () {
      var size = parseInt($('input[name="cfg-size"]:checked', cfg).value, 10);
      var cond = $('input[name="cfg-cond"]:checked', cfg).value;
      var col = $('input[name="cfg-color"]:checked', cfg);
      return { size: size, cond: cond, hex: col.value, name: col.getAttribute('data-name') };
    };
    var apply = function () {
      var s = read(); var text = s.size + ' ft · ' + s.cond + ' · ' + s.name;
      sum.textContent = text;
      var q = new URLSearchParams(); q.set('service', 'Container Trading'); q.set('cfg', text);
      ccta.href = 'contact.html?' + q.toString() + '#contact-form';
      var detail = { color: s.hex, len: s.size, used: s.cond === 'Used' };
      window.__lastCfg = detail; emit('container:set', detail);
    };
    $$('input', cfg).forEach(function (i) { i.addEventListener('change', apply); });
    apply();
  }

  /* ---------- tabs (about: mission / vision / philosophy) ---------- */
  $$('[data-tabs]').forEach(function (box) {
    var tabs = $$('[role="tab"]', box), panels = tabs.map(function (t) { return d.getElementById(t.getAttribute('aria-controls')); });
    function select(i, focus) {
      tabs.forEach(function (t, k) { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; panels[k].hidden = k !== i; });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length;
        if (k === 'ArrowDown' || k === 'ArrowRight') { select((i + 1) % n, true); e.preventDefault(); }
        else if (k === 'ArrowUp' || k === 'ArrowLeft') { select((i - 1 + n) % n, true); e.preventDefault(); }
        else if (k === 'Home') { select(0, true); e.preventDefault(); }
        else if (k === 'End') { select(n - 1, true); e.preventDefault(); }
      });
    });
    select(0);   // progressive: without JS every panel simply stays visible
  });

  /* ---------- table of contents spy (privacy / terms) ---------- */
  var toc = $('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var tl = $$('a[href^="#"]', toc), heads = tl.map(function (a) { return $(a.getAttribute('href')); }), cur = null;
    var tspy = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) cur = en.target; });
      tl.forEach(function (a, i) { a.setAttribute('aria-current', heads[i] === cur ? 'true' : 'false'); });
    }, { rootMargin: '-20% 0px -70% 0px' });
    heads.forEach(function (h) { if (h) tspy.observe(h); });
  }

  /* ---------- contact form: pre-fill from the planner / builder ---------- */
  var form = $('#contact-form');
  if (form && window.location.search) {
    var qs = new URLSearchParams(window.location.search);
    var f = qs.get('from'), t = qs.get('to'), s = qs.get('service'), det = qs.get('detail'), c = qs.get('cfg'), k = qs.get('km');
    var lines = [];
    if (f || t) lines.push('Route: ' + (f || '?') + ' → ' + (t || '?') + (k ? ' (about ' + Number(k).toLocaleString('en-US') + ' km straight-line)' : ''));
    if (s) lines.push('Service: ' + s + (det ? ' (' + det + ')' : ''));
    if (c) lines.push('Container: ' + c);
    if (lines.length) {
      var sel = $('#service'); if (sel && s) { for (var i = 0; i < sel.options.length; i++) if (sel.options[i].text.toLowerCase() === s.toLowerCase()) sel.selectedIndex = i; }
      var msg = $('#message'); if (msg && !msg.value) msg.value = lines.join('\n') + '\n\nCargo and timing: ';
      var note = d.createElement('div'); note.className = 'prefill'; note.setAttribute('role', 'status');
      note.innerHTML = '<span>We filled in your details from the planner. Add your cargo and timing, then send.</span><button type="button" aria-label="Dismiss">Dismiss</button>';
      form.insertBefore(note, form.firstChild);
      note.querySelector('button').addEventListener('click', function () { note.remove(); });
    }
  }
})();
