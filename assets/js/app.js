/* SS Gulf Shipping — site behaviour (vanilla JS, no dependencies) */
(function () {
  'use strict';
  var d = document;
  var root = d.documentElement;
  var reduce = root.classList.contains('reduce');
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); };

  /* ---------- Header: solid after scroll ---------- */
  var hdr = d.querySelector('.hdr');
  function headerState() { if (hdr) hdr.classList.toggle('is-solid', window.scrollY > 40); }
  headerState();
  window.addEventListener('scroll', headerState, { passive: true });

  /* ---------- Mobile menu ---------- */
  var burger = d.querySelector('.burger');
  var nav = d.getElementById('site-nav');
  function setMenu(open) {
    root.classList.toggle('menu-open', open);
    if (burger) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
  }
  if (burger && nav) {
    burger.addEventListener('click', function () { setMenu(!root.classList.contains('menu-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
    });
    window.matchMedia('(min-width: 861px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });
  }

  /* ---------- Reveal on scroll ---------- */
  var rv = [].slice.call(d.querySelectorAll('.rv'));
  if (rv.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      rv.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          // reveal when visible, or when already scrolled past (anchor jumps, page reloads mid-scroll)
          if (en.isIntersecting || en.boundingClientRect.bottom < 0) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      rv.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- Count-up numbers ---------- */
  var counters = [].slice.call(d.querySelectorAll('[data-count]'));
  function runCount(el) {
    var to = parseInt(el.getAttribute('data-count'), 10);
    if (reduce) { el.textContent = to; return; }
    var t0 = null, dur = 1400;
    (function step(t) {
      if (t0 === null) t0 = t;
      var k = clamp((t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  if (counters.length && 'IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { runCount(en.target); co.unobserve(en.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
  }

  /* ---------- Scroll story (home): scroll drives a push through the port photos ---------- */
  var track = d.querySelector('[data-story]');
  if (track && !reduce) {
    var layers = [].slice.call(track.querySelectorAll('.layer'));
    var chaps = [].slice.call(track.querySelectorAll('.chap'));
    var dots = [].slice.call(track.querySelectorAll('.rail .rb'));
    var bar = track.querySelector('.rail b');
    var hero = track.querySelector('.hero-copy');
    var cue = track.querySelector('.cue');
    var steps = layers.length - 1;           // 4 transitions for 5 layers
    // the chapter dots are buttons: jump to a chapter
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        var max = track.offsetHeight - window.innerHeight;
        window.scrollTo({ top: track.getBoundingClientRect().top + window.scrollY + (i / steps) * 0.92 * max, behavior: 'smooth' });
      });
    });
    var target = 0, cur = 0, raf = 0;

    function measure() {
      var max = track.offsetHeight - window.innerHeight;
      target = max > 0 ? clamp(-track.getBoundingClientRect().top / max) : 0;
    }

    function render() {
      // 0..1 scroll -> 0..steps, with a short hold at both ends
      var f = clamp(cur / 0.92) * steps;

      layers.forEach(function (img, i) {
        var life = clamp((f - (i - 0.7)) / 2);
        var o = i === 0 ? 1 : clamp((f - (i - 0.7)) / 0.4);
        img.style.opacity = o;
        img.style.transform = 'translate3d(0,' + (-life * 2).toFixed(3) + '%,0) scale(' + (1.03 + life * 0.1).toFixed(4) + ')';
      });

      var ho = 1 - clamp(f / 0.3);
      hero.style.opacity = ho;
      hero.style.transform = 'translate3d(0,' + (-f * 70).toFixed(1) + 'px,0)';
      hero.style.visibility = ho < 0.02 ? 'hidden' : 'visible';

      chaps.forEach(function (c, k) {
        var j = k + 1;
        var o = 1 - clamp((Math.abs(f - j) - 0.2) / 0.25);
        c.style.opacity = o;
        c.style.transform = 'translate3d(0,' + ((1 - o) * (f < j ? 28 : -28)).toFixed(1) + 'px,0)';
        c.style.visibility = o < 0.02 ? 'hidden' : 'visible';
        c.classList.toggle('is-on', o > 0.5);
      });

      window.__storyF = f;   // read by the 3D scene (port3d)
      window.dispatchEvent(new CustomEvent('story:progress', { detail: { f: f } }));

      var idx = Math.round(f);
      dots.forEach(function (dot, i) { dot.classList.toggle('on', i === idx); });
      if (bar) bar.style.setProperty('--p', (f / steps).toFixed(3));
      if (cue) cue.style.opacity = 1 - clamp(f / 0.15);
    }

    var lastT = 0;
    function loop(t) {
      // time-based easing: settles in about a second whatever the frame rate
      var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0.016; lastT = t;
      cur += (target - cur) * (1 - Math.exp(-dt * 9));
      if (Math.abs(target - cur) < 0.0003) cur = target;
      render();
      raf = cur !== target ? requestAnimationFrame(loop) : 0;
      if (!raf) lastT = 0;
    }
    function kick() { measure(); if (!raf) raf = requestAnimationFrame(loop); }

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    measure(); cur = target; render();
  }

  /* ---------- 3D tilt (mouse / trackpad only) ---------- */
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    [].slice.call(d.querySelectorAll('.card,.office,.bt--stat,.pillar')).forEach(function (el) {
      var max = el.classList.contains('collage') ? 7 : el.classList.contains('svc-row__img') ? 5 : 8;
      el.setAttribute('data-tilt', '');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--gx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
        el.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * max).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((-((e.clientY - r.top) / r.height - 0.5)) * max).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---------- Contact form ---------- */
  var form = d.getElementById('contact-form');
  if (form) {
    var status = d.getElementById('form-status');
    var MAIL = 'sos@ssgulfshipping.com';
    var msgs = {
      fname: 'Please enter your first name.',
      lname: 'Please enter your last name.',
      email: 'Please enter a valid email address.',
      message: 'Please tell us a little about your shipment.'
    };
    var fields = [].slice.call(form.querySelectorAll('input, select, textarea'));

    function check(el) {
      var err = d.getElementById(el.id + '-err');
      var bad = !el.checkValidity();
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (err) err.textContent = bad ? (msgs[el.id] || 'This field is required.') : '';
      return !bad;
    }
    fields.forEach(function (el) {
      el.addEventListener('blur', function () { if (el.value || el.getAttribute('aria-invalid') === 'true') check(el); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid') === 'true') check(el); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      fields.forEach(function (el) { if (!check(el) && !firstBad) firstBad = el; });
      if (firstBad) { firstBad.focus(); return; }

      var v = function (id) { return form.elements[id].value.trim(); };
      var body = [
        'Name: ' + v('fname') + ' ' + v('lname'),
        'Email: ' + v('email'),
        'Phone: ' + (v('phone') || '-'),
        'Service: ' + v('service'),
        '',
        v('message')
      ].join('\n');
      var subject = 'Quote request: ' + v('service');
      status.hidden = false;
      status.textContent = 'Opening your email app with your message ready to send to ' + MAIL + '. If nothing opens, email us directly at that address.';
      window.location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    });
  }
})();
