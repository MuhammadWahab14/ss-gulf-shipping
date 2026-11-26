/* SS Gulf Shipping: scroll-driven home hero.
   Scrolling scrubs a reach-stacker clip (it loads a truck), then the services strip slides in past giant "OUR SERVICES" letters.
   The vehicles are never drawn or moved in code: all their motion is in the video. The video is never played, only scrubbed. */
(function () {
  'use strict';
  var kv = document.getElementById('kv'); if (!kv) return;
  var URL_1080 = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/409763c0-95f4-49d3-a601-dc564d55072b.mp4';
  var URL_720 = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/b3718419-7a0a-478d-bfb0-0ff8bef7f3f7.mp4';
  var A = 2.4;                          // viewports of scroll spent on the handling clip
  var FRAME_W = 1920, FRAME_H = 1080;   // intrinsic size of the clip
  var BAND_FINAL = 0.448, BAND_START = 0.829;

  var scene = document.getElementById('kv-scene'), vid = document.getElementById('kv-vid'), giant = document.getElementById('kv-giant');
  var copy = document.getElementById('kv-copy'), speedEl = document.getElementById('kv-speed'), strip = document.getElementById('kv-strip');
  var pill = kv.querySelector('.kv__pill');
  var cards = [].slice.call(kv.querySelectorAll('.kv__card'));
  var reduce = document.documentElement.classList.contains('reduce');

  function clamp(v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); }

  vid.muted = true; vid.defaultMuted = true;
  vid.src = matchMedia('(max-width: 900px)').matches ? URL_720 : URL_1080;
  try { vid.load(); } catch (e) { /* the poster stays up */ }
  function dur() { return (vid.duration && isFinite(vid.duration)) ? vid.duration : 4.04; }

  var vw = 0, vh = 0, B = 1, stripW = 0, giantW = 0, cardX = [];

  function layout() {
    vw = scene.clientWidth || innerWidth; vh = scene.clientHeight || innerHeight;
    var portrait = vw < 768 || vw <= vh, w, h, left, top;
    if (!portrait) {
      var sc = Math.max(vw / FRAME_W, vh / FRAME_H);
      w = FRAME_W * sc; h = FRAME_H * sc; left = (vw - w) / 2; top = (vh - h) / 2;
    } else {
      w = vw * 1.55; h = w * FRAME_H / FRAME_W; left = vw * 0.5 - 0.4 * w; top = vh * 0.36 - BAND_FINAL * h;
    }
    vid.style.width = w + 'px'; vid.style.height = h + 'px'; vid.style.left = left + 'px'; vid.style.top = top + 'px';
    scene.style.setProperty('--edge-px', (top + BAND_FINAL * h) + 'px');
    scene.style.setProperty('--line', (top + BAND_START * h) + 'px');

    stripW = strip.scrollWidth; giantW = giant.offsetWidth;
    cardX = cards.map(function (c) { return c.offsetLeft; });
    B = (stripW + 0.45 * vw) / vw * 1.1;
    kv.style.height = ((1 + A + B) * vh) + 'px';
  }

  var cur = 0, lastY = scrollY, lastT = performance.now(), sm = 0, settled = null;

  function seek() {
    if (!vid.seeking && Math.abs(cur - vid.currentTime) > 1 / 60) { try { vid.currentTime = cur; } catch (e) { /* not ready yet */ } }
  }
  vid.addEventListener('seeked', seek);
  vid.addEventListener('loadedmetadata', function () { layout(); seek(); });

  function render(y) {
    // scroll is relative to the top of the hero, so the page can keep content above it
    var q = clamp(y / (A * vh));
    var target = q * (dur() - 1 / 48);
    cur = reduce ? target : cur + (target - cur) * 0.2;
    seek();

    var on = q >= 0.94;
    if (on !== settled) { settled = on; kv.style.setProperty('--ph', on ? '1' : '0'); kv.toggleAttribute('data-on', on); if (pill) pill.tabIndex = on ? 0 : -1; }
    var fade = 1 - clamp(q / 0.1);
    copy.style.opacity = fade.toFixed(3); copy.style.visibility = fade < 0.02 ? 'hidden' : 'visible';

    var r = clamp((y - A * vh) / (B * vh));
    var sx = vw - r * (stripW + 0.45 * vw);
    strip.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,0,0)';
    giant.style.transform = 'translate3d(' + (vw - r * (giantW + vw)).toFixed(1) + 'px,-100%,0)';
    for (var i = 0; i < cards.length; i++) {
      var s = clamp((0.98 - (sx + cardX[i]) / vw) / 0.3, -0.4, 1.6) * 100;
      cards[i].style.setProperty('--s', s.toFixed(1) + '%');
    }
  }

  function frame(now) {
    var y = scrollY, dt = Math.max(1, now - lastT) / 1000;
    var v = Math.abs(y - lastY) / dt / 32;
    sm += (v - sm) * 0.15; lastY = y; lastT = now;
    speedEl.textContent = String(Math.min(99, Math.round(sm))).padStart(2, '0') + ' KM/H';
    render(y - kv.offsetTop);
    requestAnimationFrame(frame);
  }

  layout();
  addEventListener('resize', layout);
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  requestAnimationFrame(frame);
})();
