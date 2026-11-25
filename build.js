/* Generates the static pages. Run:  node build.js   (output: *.html next to this file) */
const fs = require('fs');
const path = require('path');

/* ---------------- Site data (content from ssgulfshipping.com) ---------------- */
const SITE = 'SS Gulf Shipping';
const PHONE_PT = { show: '+351 920 630 874', tel: '+351920630874' };
const PHONE_PK = { show: '+92 312 2829789', tel: '+923122829789' };
const EMAILS = ['sos@ssgulfshipping.com', 'mhi@ssgulfshipping.com', 'syedfahad@ssgulfshipping.com'];
const HOURS = 'Mon – Sat: 09 am – 06 pm';

const SERVICES = [
  { id: 'freight-forwarding', title: 'Freight Forwarding Services', short: 'Freight Forwarding', icon: 'globe',
    img: 'loading.jpg', alt: 'Container crane lifting a shipping container onto a vessel while port workers and trucks operate below',
    text: 'SS Gulf Shipping partners with trusted shipping lines to transport your cargo efficiently, on both FCL and LCL basis.',
    bullets: ['FCL and LCL shipments', 'Documentation and customs coordination', 'Cargo booking with trusted shipping lines'] },
  { id: 'nvocc', title: 'NVOCC Services', short: 'NVOCC', icon: 'ship',
    img: 'night.webp', alt: 'Large container ship with a tugboat alongside at night in a lit port',
    text: 'SS Gulf Shipping offers secure and efficient cargo transport using our own containers, delivering your goods safely and on time to any port worldwide.',
    bullets: ['Cargo moved in our own containers', 'Secure and efficient handling', 'Delivery to any port worldwide'] },
  { id: 'trucking', title: 'Trucking Services', short: 'Trucking', icon: 'truck',
    img: 'truck.jpg', alt: 'White articulated truck parked in a container terminal at sunset',
    text: 'SS Gulf Shipping provides reliable road transport, ensuring your shipments reach their destination safely and on time.',
    bullets: ['Reliable road transport', 'Safe delivery, on time, to destination'] },
  { id: 'container-trading', title: 'Container Trading Services', short: 'Container Trading', icon: 'box',
    img: 'containers.jpg', alt: 'Stacked blue and rust-coloured shipping containers with a red container handler at sunset',
    text: 'SS Gulf Shipping offers new and used containers at competitive market prices.',
    bullets: ['New containers', 'Used containers', 'Competitive market prices'] }
];

const PORTS = [
  ['Karachi', 'Pakistan'], ['Jebel Ali', 'Dubai, UAE'], ['Sohar', 'Oman'], ['Mundra', 'India'], ['Nhava Sheva', 'India'],
  ['Chittagong', 'Bangladesh'], ['Hamburg', 'Germany'], ['All over Europe', 'Europe'], ['Laem Chabang', 'Thailand'], ['Bangkok', 'Thailand'], ['Haiphong', 'Vietnam']
];

const WHY = [
  ['Experienced shipping professionals', 'People who understand documentation, customs coordination and cargo booking, and keep every step moving.'],
  ['Competitive pricing', 'Cost-effective, flexible shipping solutions shaped around what your cargo needs.'],
  ['On-time delivery commitment', 'Our promise is simple: deliver cargo safely, on time, every time.'],
  ['Strong partner network', 'We work with trusted shipping lines and partners across the ports we serve.'],
  ['Customer-centric approach', 'Long-term partnerships built on trust and performance, starting with your business needs.']
];


const PORT_GEO = { 'Karachi': [24.86, 67.0], 'Jebel Ali': [25.0, 55.06], 'Sohar': [24.37, 56.73], 'Mundra': [22.74, 69.7], 'Nhava Sheva': [18.95, 72.95], 'Chittagong': [22.33, 91.8], 'Hamburg': [53.55, 9.99], 'All over Europe': [47.5, 14.5], 'Laem Chabang': [13.08, 100.88], 'Bangkok': [13.7, 100.5], 'Haiphong': [20.85, 106.7] };
const PLANNER_DATA = JSON.stringify(PORTS.map(([n, c]) => ({ n, c, la: PORT_GEO[n][0], lo: PORT_GEO[n][1] }))).replace(/"/g, '&quot;');
const PORT_OPTIONS = PORTS.map(([n, c]) => `<option value="${n}">${n}</option>`).join('') + '<option value="">Other / not listed</option>';

/* ---------------- Helpers ---------------- */
const ic = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;

const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M7 17L17 7M8 7h9v9"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
<symbol id="i-ship" viewBox="0 0 24 24"><path d="M2.5 16h19l-2.6 4.5H5.1z"/><path d="M5 16v-5h14v5M9 11V7.5h6V11M12 7.5V4"/></symbol>
<symbol id="i-truck" viewBox="0 0 24 24"><path d="M2 6.5h11V16H2zM13 10h4.5l3.5 3.5V16H13z"/><circle cx="6.5" cy="17.5" r="1.9"/><circle cx="17" cy="17.5" r="1.9"/></symbol>
<symbol id="i-box" viewBox="0 0 24 24"><rect x="3" y="6.5" width="18" height="11" rx="1.5"/><path d="M7 6.5v11M11 6.5v11M15 6.5v11M19 6.5v11"/></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5L15.5 9.5"/></symbol>
<symbol id="i-handshake" viewBox="0 0 24 24"><path d="M3 11l4-4 4 2 3-2 4 3 3-1v6l-5 4-3-2-2 1-4-1-4-3z"/></symbol>
<symbol id="i-gauge" viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
</defs></svg>`;

const NAV = [['index.html', 'Home'], ['about.html', 'About us'], ['services.html', 'Our services'], ['contact.html', 'Contact us']];

const IMPORTMAP = `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>`;
// The 3D scene is inlined so the site still works when opened straight from disk (file:// blocks external module files).
const PORT3D = fs.readFileSync(path.join(__dirname, 'assets/js/port3d.js'), 'utf8');

const VIEWERS3D = fs.readFileSync(path.join(__dirname, 'assets/js/viewers3d.js'), 'utf8');
const MODELS = { 'freight-forwarding': 'ship', nvocc: 'container', trucking: 'truck', 'container-trading': 'stack' };
const VLABEL = { ship: 'Interactive 3D container ship. Drag or use the arrow keys to rotate.', container: 'Interactive 3D SS Gulf Shipping container. Drag or use the arrow keys to rotate.', truck: 'Interactive 3D truck. Drag or use the arrow keys to rotate.', stack: 'Interactive 3D stack of shipping containers. Drag or use the arrow keys to rotate.' };

function head({ title, desc, jsonld, three }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#06111F">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<link rel="icon" type="image/png" href="assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@700;800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>(function(r){r.classList.add('js');if(matchMedia('(prefers-reduced-motion: reduce)').matches)r.classList.add('reduce')})(document.documentElement)</script>
<link rel="stylesheet" href="assets/css/styles.css">${three ? '\n' + IMPORTMAP : ''}${jsonld ? `\n<script type="application/ld+json">${jsonld}</script>` : ''}
</head>`;
}

function header(active, inner) {
  const links = NAV.map(([href, label]) => `<a class="nl" href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('\n      ');
  return `<a class="skip" href="#main">Skip to content</a>
${SPRITE}
<header class="hdr">
  <div class="wrap hdr__in">
    <a class="brand" href="index.html" aria-label="${SITE} — home">
      <img src="assets/img/logo.png" width="50" height="50" alt="">
      <span>SS Gulf<small>SHIPPING LLC</small></span>
    </a>
    <button class="burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">${ic('menu', 'm')}${ic('close', 'x')}</button>
    <nav id="site-nav" class="nav" aria-label="Main">
      ${links}
      <a class="btn btn--primary" href="contact.html">Get a quote ${ic('arrow')}</a>
    </nav>
  </div>
</header>`;
}

function footer() {
  return `<footer class="ftr">
  <div class="wrap">
    <div class="ftr__grid">
      <div>
        <a class="brand" href="index.html" aria-label="${SITE} — home"><img src="assets/img/logo.png" width="50" height="50" alt=""><span>SS Gulf<small>SHIPPING LLC</small></span></a>
        <p>SS Gulf Shipping is a customer-focused logistics company providing reliable freight solutions with efficient cargo handling and timely delivery worldwide.</p>
      </div>
      <div>
        <h4>Quick links</h4>
        <ul>${NAV.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>Services</h4>
        <ul>${SERVICES.map(s => `<li><a href="services.html#${s.id}">${s.short === 'NVOCC' ? 'NVOCC Services' : s.title}</a></li>`).join('')}</ul>
      </div>
      <div>
        <h4>Contact us</h4>
        <ul class="fcontact">
          <li>${ic('pin')}<span><b>Karachi, Pakistan</b><a href="tel:${PHONE_PK.tel}">${PHONE_PK.show}</a></span></li>
          <li>${ic('pin')}<span><b>Lisbon, Portugal</b><a href="tel:${PHONE_PT.tel}">${PHONE_PT.show}</a></span></li>
          <li>${ic('pin')}<span><b>Dubai, UAE</b><a href="mailto:${EMAILS[0]}">Reach us by email</a></span></li>
          <li>${ic('mail')}<span>${EMAILS.map(e => `<a href="mailto:${e}">${e}</a>`).join('<br>')}</span></li>
          <li>${ic('clock')}<span>${HOURS}</span></li>
        </ul>
      </div>
    </div>
    <div class="ftr__base">
      <span>© 2026 ${SITE}. All rights reserved.</span>
      <nav aria-label="Legal"><a href="terms.html">Terms &amp; Conditions</a><a href="privacy.html">Privacy Policy</a></nav>
    </div>
  </div>
</footer>
<script src="assets/js/app.js" defer></script>
<script src="assets/js/interact.js" defer></script>
</body>
</html>`;
}

function page({ file, title, desc, body, inner = true, jsonld, three = false, viewers = false }) {
  let html = `${head({ title, desc, jsonld, three })}
<body${inner ? ' class="page-inner"' : ''}>
${header(file, inner)}
<main id="main">
${body}
</main>
${footer()}`;
  if (three) html = html.replace('</body>', `<script type="module">\n${PORT3D}\n</script>\n</body>`);
  if (viewers) html = html.replace('</body>', `<script type="module">\n${VIEWERS3D}\n</script>\n</body>`);
  fs.writeFileSync(path.join(__dirname, file), html);
  console.log('wrote', file, (html.length / 1024).toFixed(1) + ' KB');
}

const pageHero = ({ img, alt, h1, crumb, view, tod }) => `<section class="phero"${view ? ` data-3d="${view}" data-tod="${tod}"` : ''}>
  <div class="phero__bg"><img src="assets/img/${img}" alt="" fetchpriority="high"></div>
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">${crumb}</span></nav>
    <h1 class="display">${h1}</h1>
  </div>
</section>`;

const cta = `<section class="cta2" aria-labelledby="cta-h">
  <div class="wrap">
    <div class="cta2__card rv">
      <div class="cta2__l">
        <span class="eyebrow">Let’s talk</span>
        <h2 id="cta-h" class="display">Need our services?</h2>
        <p>Get reliable shipping and logistics solutions tailored to your needs. Connect with our experts to plan your shipments.</p>
        <div class="row"><a class="btn btn--dark" href="contact.html">Contact us ${ic('arrow')}</a><a class="btn btn--ghost-dark" href="services.html">Explore services</a></div>
      </div>
      <ul class="cta2__r">
        <li><a href="tel:${PHONE_PT.tel}">${ic('phone')}<span><small>Lisbon</small>${PHONE_PT.show}</span></a></li>
        <li><a href="tel:${PHONE_PK.tel}">${ic('phone')}<span><small>Karachi</small>${PHONE_PK.show}</span></a></li>
        <li><a href="mailto:${EMAILS[0]}">${ic('mail')}<span><small>Email</small>${EMAILS[0]}</span></a></li>
      </ul>
    </div>
  </div>
</section>`;

const portsBlock = (cls = 'sec--navy2') => `<section class="sec ${cls} ports-sec" aria-labelledby="ports-h">
  <div class="wrap pgrid">
    <div class="pgrid__globe">
      <div class="viewer viewer--globe rv" data-viewer="globe" role="group" aria-label="Interactive 3D globe marking the ports and regions SS Gulf Shipping works. Drag or use the arrow keys to rotate; tap a port to select it."></div>
    </div>
    <div class="pgrid__ui">
      <span class="eyebrow rv">Where we work</span>
      <h2 id="ports-h" class="display h2 rv" style="margin:18px 0 14px;max-width:none">Our currently working ports</h2>
      <p class="lead rv">Ports across the Gulf, the Indian subcontinent, South-East Asia and all over Europe.</p>
      <form class="planner rv" id="planner" data-ports="${PLANNER_DATA}" onsubmit="return false" aria-labelledby="pl-h">
        <span class="eyebrow">Plan your shipment</span>
        <h3 id="pl-h" class="display">Pick a route</h3>
        <div class="pl-row">
          <label>From<select id="pl-from">${PORT_OPTIONS}</select></label>
          <button type="button" class="pl-swap" id="pl-swap" aria-label="Swap origin and destination"><svg class="i" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 7h12M15 3l4 4-4 4M17 17H5M9 13l-4 4 4 4"/></svg></button>
          <label>To<select id="pl-to">${PORT_OPTIONS}</select></label>
        </div>
        <label>Service
          <select id="pl-service">
            <option value="Freight Forwarding|FCL">Freight forwarding · FCL</option>
            <option value="Freight Forwarding|LCL">Freight forwarding · LCL</option>
            <option value="NVOCC|">NVOCC (our own containers)</option>
            <option value="Trucking|">Trucking</option>
            <option value="Container Trading|">Container trading</option>
          </select>
        </label>
        <p class="pl-out" aria-live="polite"><b id="pl-route">Choose a route</b><span id="pl-dist"></span></p>
        <a class="btn btn--primary" id="pl-cta" href="contact.html#contact-form">Request a quote for this route ${ic('arrow')}</a>
        <p class="pl-note">Tip: tap a port on the globe or in the list below to set your destination. The route is illustrative; we confirm routing, schedules and rates with you directly.</p>
      </form>
      <ul class="ports ports--chips">
        ${PORTS.filter(([n]) => n !== 'Karachi').map(([n, c], i) => `<li class="rv" style="--d:${(i % 6) * 0.05}s"><span>${String(i + 1).padStart(2, '0')}</span><b>${n}</b><small>${c}</small></li>`).join('\n        ')}
      </ul>
    </div>
  </div>
</section>`;

/* ---------------- HOME ---------------- */
const chapters = [
  ['01', SERVICES[0]], ['02', SERVICES[1]], ['03', SERVICES[2]], ['04', SERVICES[3]]
];

page({
  file: 'index.html', inner: false, three: true, viewers: true,
  title: 'SS Gulf Shipping — Moving your cargo with confidence',
  desc: 'Freight forwarding, NVOCC, trucking and container trading from Karachi, Lisbon and Dubai. Efficient cargo handling, transparent operations and on-time delivery.',
  jsonld: JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Organization', name: SITE, url: 'https://ssgulfshipping.com/',
    email: EMAILS[0], telephone: PHONE_PT.tel,
    address: [{ '@type': 'PostalAddress', addressLocality: 'Karachi', addressCountry: 'PK' }, { '@type': 'PostalAddress', addressLocality: 'Lisbon', addressCountry: 'PT' }, { '@type': 'PostalAddress', addressLocality: 'Dubai', addressCountry: 'AE' }]
  }),
  body: `
<section class="track" data-story aria-label="Our services, scroll to explore">
  <div class="scene">
    <img class="layer layer--0" src="assets/img/hero.jpg" alt="Container port at dusk with gantry cranes, stacked containers and a yellow terminal truck" fetchpriority="high" decoding="async">
    <img class="layer" src="assets/img/loading.jpg" alt="" decoding="async" fetchpriority="low" style="opacity:0">
    <img class="layer" src="assets/img/night.webp" alt="" decoding="async" fetchpriority="low" style="opacity:0">
    <img class="layer" src="assets/img/truck.jpg" alt="" decoding="async" fetchpriority="low" style="opacity:0">
    <img class="layer" src="assets/img/containers.jpg" alt="" decoding="async" fetchpriority="low" style="opacity:0">
    <div class="shade"></div>
    <div class="stage">
      <div class="wrap">
        <div class="hero-copy">
          <span class="eyebrow">Karachi &nbsp;·&nbsp; Lisbon &nbsp;·&nbsp; Dubai &nbsp;·&nbsp; Global freight</span>
          <h1 class="display">Moving your cargo with <em>confidence.</em></h1>
          <p class="lead">Reliable freight forwarding and logistics across regional and international markets. Efficient cargo handling, transparent operations and on-time delivery from origin to destination.</p>
          <div class="actions">
            <a class="btn btn--primary" href="contact.html">Get a quote ${ic('arrow')}</a>
            <a class="callchip" href="tel:${PHONE_PT.tel}"><i>${ic('phone')}</i><span>Call us any time<b>${PHONE_PT.show}</b></span></a>
          </div>
        </div>
        ${chapters.map(([n, s]) => `<div class="chap">
          <span class="chap__n" aria-hidden="true">${n}</span>
          <h2 class="display">${s.title}</h2>
          <p>${s.text}</p>
          <a class="link" href="services.html#${s.id}">Learn more ${ic('arrow')}</a>
        </div>`).join('\n        ')}
      </div>
    </div>
    <div class="rail" role="group" aria-label="Jump to a chapter"><button type="button" class="rb on" data-l="Intro" aria-label="Intro"></button><button type="button" class="rb" data-l="Freight forwarding" aria-label="Freight forwarding"></button><button type="button" class="rb" data-l="NVOCC" aria-label="NVOCC"></button><button type="button" class="rb" data-l="Trucking" aria-label="Trucking"></button><button type="button" class="rb" data-l="Container trading" aria-label="Container trading"></button><b aria-hidden="true"></b></div>
    <div class="cue" aria-hidden="true">Scroll</div>
  </div>
</section>

<section class="sec sec--paper" aria-labelledby="about-h">
  <div class="wrap">
    <div class="bento">
      <article class="bt bt--about rv">
        <img class="bt__bg" src="assets/img/tug.webp" width="1280" height="720" loading="lazy" alt="Red and white tugboat guiding a container ship alongside gantry cranes">
        <div class="bt__in">
          <span class="eyebrow">About company</span>
          <h2 id="about-h" class="display">Strengthening your supply chain, one shipment at a time</h2>
          <p>SS Gulf Shipping is a reliable and customer-focused logistics and shipping company providing end-to-end freight forwarding solutions across regional and international markets. We specialize in efficient cargo handling, transparent operations, and timely delivery, ensuring every shipment is managed with responsibility and precision from origin to destination.</p>
          <div class="bt__row"><ul class="ticks ticks--light"><li>${ic('check')}Affordable pricing</li><li>${ic('check')}On-time deliveries</li></ul><a class="btn btn--primary" href="about.html">Read more ${ic('arrow')}</a></div>
        </div>
      </article>
      <div class="bt bt--stat bt--orange rv" style="--d:.06s"><b><span data-count="10">10</span></b><span>Ports &amp; regions served</span></div>
      <div class="bt bt--stat bt--navy rv" style="--d:.12s"><b><span data-count="2">2</span><sup>+</sup></b><span>Years of experience</span></div>
      <div class="bt bt--stat bt--w6 bt--line rv" style="--d:.18s"><b><span data-count="3">3</span></b><span>Offices: Karachi, Lisbon &amp; Dubai</span></div>
      <div class="bt bt--stat bt--w6 bt--ink rv" style="--d:.24s"><b><span data-count="4">4</span></b><span>Core services</span></div>
    </div>
  </div>
</section>

<section class="sec sec--navy" aria-labelledby="svc-h">
  <div class="wrap">
    <div class="sec__head">
      <div class="rv"><span class="eyebrow">What we offer</span><h2 id="svc-h" class="display h2">Our popular logistics services</h2></div>
      <a class="btn btn--ghost rv" style="--d:.1s" href="services.html">View all ${ic('arrow')}</a>
    </div>
    <div class="svc-bento">
      ${SERVICES.map((s, i) => `<a class="card ${i === 0 ? 'card--feature' : 'card--row'} rv" style="--d:${i * 0.07}s" href="services.html#${s.id}">
        <div class="card__img viewer" data-viewer="${MODELS[s.id]}" role="group" aria-label="${VLABEL[MODELS[s.id]]}"><img src="assets/img/${s.img}" loading="lazy" alt="${s.alt}"><span class="card__ic">${ic(s.icon)}</span></div>
        <div class="card__body"><span class="card__n">0${i + 1}</span><h3>${s.title}</h3><p>${s.text}</p><span class="link">Read more ${ic('arrow')}</span></div>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>

${portsBlock('sec--navy2')}

<section class="sec sec--paper" aria-labelledby="why-h">
  <div class="wrap">
    <div class="sec__head">
      <div class="rv"><span class="eyebrow">Why choose us</span><h2 id="why-h" class="display h2">In a fast world, we deliver on time.</h2></div>
      <p class="lead rv" style="--d:.1s">From first enquiry to final delivery, our team keeps your cargo moving and keeps you informed.</p>
    </div>
    <ol class="pillars">
      ${WHY.map(([t, p], i) => `<li class="pillar rv" style="--d:${i * 0.06}s"><span class="pillar__n">${String(i + 1).padStart(2, '0')}</span><h3>${t}</h3><p>${p}</p></li>`).join('\n      ')}
    </ol>
  </div>
</section>

${cta}`
});

/* ---------------- ABOUT ---------------- */
page({
  file: 'about.html', three: true, viewers: true,
  title: 'About us — SS Gulf Shipping',
  desc: 'SS Gulf Shipping is a customer-focused logistics and shipping company: our mission, vision, philosophy and core values.',
  body: `
${pageHero({ img: 'tug.webp', h1: 'About us', crumb: 'About us', view: 'ship', tod: 0.62 })}

<section class="sec sec--paper" aria-labelledby="co-h">
  <div class="wrap">
    <span class="eyebrow rv">About company</span>
    <h2 id="co-h" class="display h2h rv">Strengthening your supply chain, one shipment at a time</h2>
    <p class="lead lead--offset rv" style="--d:.1s">SS Gulf Shipping is a reliable and customer-focused logistics and shipping company providing end-to-end freight forwarding solutions across regional and international markets. We specialize in efficient cargo handling, transparent operations, and timely delivery, ensuring every shipment is managed with responsibility and precision from origin to destination.</p>
    <div class="trip">
      <figure class="trip__i rv"><img src="assets/img/docks.webp" width="1300" height="866" loading="lazy" alt="Colourful stacked containers beneath blue quay cranes at a container terminal"><figcaption>Container terminal</figcaption></figure>
      <figure class="trip__i trip__i--mid rv" style="--d:.1s"><img src="assets/img/truck.jpg" width="1920" height="1047" loading="lazy" alt="White articulated truck in a container terminal at sunset"><figcaption>Road transport</figcaption></figure>
      <figure class="trip__i rv" style="--d:.2s"><img src="assets/img/containers.jpg" width="1920" height="1048" loading="lazy" alt="Stacked blue and rust-coloured shipping containers with a red container handler at sunset"><figcaption>Container yard</figcaption></figure>
    </div>
  </div>
</section>

<section class="sec sec--navy" aria-labelledby="mv-h">
  <div class="wrap">
    <div class="sec__head"><div class="rv"><span class="eyebrow">Who we are</span><h2 id="mv-h" class="display h2">Mission, vision and philosophy</h2></div></div>
    <div class="tabs rv" data-tabs>
      <div class="tabs__list" role="tablist" aria-label="Mission, vision and philosophy">
        <button type="button" role="tab" id="tab-m" aria-controls="pan-m" aria-selected="true"><span>01</span>Mission</button>
        <button type="button" role="tab" id="tab-v" aria-controls="pan-v" aria-selected="false" tabindex="-1"><span>02</span>Vision</button>
        <button type="button" role="tab" id="tab-p" aria-controls="pan-p" aria-selected="false" tabindex="-1"><span>03</span>Philosophy</button>
      </div>
      <div class="tabs__panels">
        <div role="tabpanel" id="pan-m" aria-labelledby="tab-m" tabindex="0">
          <h3>Cargo that arrives, every time</h3>
          <ul>
            <li>${ic('check')}To deliver cargo safely, on time, every time.</li>
            <li>${ic('check')}To provide cost-effective and flexible shipping solutions.</li>
            <li>${ic('check')}To build long-term partnerships based on trust and performance.</li>
          </ul>
        </div>
        <div role="tabpanel" id="pan-v" aria-labelledby="tab-v" tabindex="0">
          <h3>A trusted global partner</h3>
          <p>To become a trusted global shipping partner recognized for reliability, efficiency, and customer satisfaction.</p>
        </div>
        <div role="tabpanel" id="pan-p" aria-labelledby="tab-p" tabindex="0">
          <h3>Trust, reliability and long-term partnerships</h3>
          <p>At SS Gulf Shipping, our philosophy is built on trust, reliability, and long-term partnerships. We believe that successful shipping is not only about moving cargo, but about delivering confidence, transparency, and value at every stage of the logistics process.</p>
          <p>We are committed to understanding our clients’ business needs and providing tailored shipping solutions that ensure efficiency, safety, and timely delivery. By combining industry expertise with ethical business practices, we strive to create sustainable growth for our clients and our company.</p>
          <p><strong>Our approach is simple: operate with integrity, perform with excellence, and deliver on every promise.</strong></p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="sec sec--paper2" aria-labelledby="val-h">
  <div class="wrap">
    <div class="sec__head"><div class="rv"><span class="eyebrow">Our core values</span><h2 id="val-h" class="display h2">What we stand for</h2></div></div>
    <ul class="vrows">
      <li class="vrow rv"><span class="vrow__n">01</span><h3>Reliability</h3><p>We deliver what we promise.</p><i>${ic('handshake')}</i></li>
      <li class="vrow rv"><span class="vrow__n">02</span><h3>Transparency</h3><p>Clear communication at every step.</p><i>${ic('eye')}</i></li>
      <li class="vrow rv"><span class="vrow__n">03</span><h3>Efficiency</h3><p>Optimized routes and processes.</p><i>${ic('gauge')}</i></li>
      <li class="vrow rv"><span class="vrow__n">04</span><h3>Integrity</h3><p>Honest and ethical operations.</p><i>${ic('shield')}</i></li>
    </ul>
  </div>
</section>

<section class="sec sec--paper" aria-labelledby="sf-h">
  <div class="wrap">
    <div class="banner rv">
      <div class="banner__t">
        <span class="eyebrow">Safety &amp; compliance</span>
        <h2 id="sf-h" class="display">Secure handling, global standards</h2>
        <p class="lead">SS Gulf Shipping operates in compliance with international maritime regulations and safety standards, ensuring secure handling of cargo and adherence to global shipping laws.</p>
      </div>
      <div class="viewer viewer--sq" data-viewer="ship" role="group" aria-label="${VLABEL.ship}"><i class="fb">${ic('shield')}</i></div>
    </div>
  </div>
</section>

${cta}`
});

/* ---------------- SERVICES ---------------- */
page({
  file: 'services.html', three: true, viewers: true,
  title: 'Our services — SS Gulf Shipping',
  desc: 'Freight forwarding (FCL and LCL), NVOCC, trucking and container trading, plus the ports and regions SS Gulf Shipping currently works, from the Gulf and India to South-East Asia and Europe.',
  body: `
${pageHero({ img: 'docks.webp', h1: 'Our services', crumb: 'Services', view: 'crane', tod: 0.05 })}
<nav class="subnav" aria-label="Jump to a section"><div class="wrap"><a href="#freight-forwarding">Freight forwarding</a><a href="#nvocc">NVOCC</a><a href="#trucking">Trucking</a><a href="#container-trading">Container trading</a><a href="#configurator">Container builder</a><a href="#ports-h">Ports &amp; planner</a></div></nav>


<section class="sec sec--paper" aria-labelledby="ff-h">
  <div class="wrap">
    <span class="eyebrow rv">What we provide</span>
    <h2 id="ff-h" class="display h2h rv">Freight forwarding, explained</h2>
    <div class="prose prose--cols rv" style="--d:.1s">
      <p>Freight forwarding is the process of organizing and managing the transportation of goods from the shipper to the final destination through one or multiple modes of transport. A freight forwarder acts as an intermediary between the exporter, importer, and carriers to ensure cargo is moved safely, efficiently, and in compliance with international trade regulations.</p>
      <p>Freight forwarders handle documentation, customs coordination, cargo booking, and shipment tracking, providing smooth and reliable logistics solutions for global trade.</p>
    </div>
  </div>
</section>

<section class="sec sec--navy stack" aria-label="Our services">
  <div class="wrap">
    ${SERVICES.map((s, i) => `<article class="svc-card" id="${s.id}" style="--i:${i}">
      <div class="svc-card__viewer viewer" data-viewer="${MODELS[s.id]}" role="group" aria-label="${VLABEL[MODELS[s.id]]}"><img src="assets/img/${s.img}" loading="lazy" alt="${s.alt}"><span class="svc-row__n" aria-hidden="true">0${i + 1}</span></div>
      <div class="svc-card__body">
        <span class="eyebrow">${s.short}</span>
        <h2 class="display">${s.title}</h2>
        <p class="lead">${s.text}</p>
        <ul class="ticks ticks--light">${s.bullets.map(b => `<li>${ic('check')}${b}</li>`).join('')}</ul>
        <div class="row"><a class="btn btn--primary" href="contact.html?service=${({ 'freight-forwarding': 'Freight+Forwarding', nvocc: 'NVOCC', trucking: 'Trucking', 'container-trading': 'Container+Trading' })[s.id]}#contact-form">Request a quote ${ic('arrow')}</a></div>
      </div>
    </article>`).join('\n    ')}
  </div>
</section>

<section class="sec sec--navy2" id="configurator" aria-labelledby="cfg-h">
  <div class="wrap">
    <div class="cfg cfg--card">
      <form class="cfg__ui rv" id="cfg" onsubmit="return false">
        <span class="eyebrow">Container trading</span>
        <h2 id="cfg-h" class="display h2">Specify your container</h2>
        <fieldset><legend>Size</legend>
          <div class="seg"><label><input type="radio" name="cfg-size" value="20"><span>20 ft</span></label><label><input type="radio" name="cfg-size" value="40" checked><span>40 ft</span></label></div>
        </fieldset>
        <fieldset><legend>Condition</legend>
          <div class="seg"><label><input type="radio" name="cfg-cond" value="New" checked><span>New</span></label><label><input type="radio" name="cfg-cond" value="Used"><span>Used</span></label></div>
        </fieldset>
        <fieldset><legend>Colour</legend>
          <div class="sws">${[['Orange', '#F37021'], ['Navy', '#0F2747'], ['Blue', '#1f4e8c'], ['Red', '#a63d2f'], ['Teal', '#2d6a6a'], ['Grey', '#7a8590'], ['Yellow', '#e0a526'], ['White', '#e7e4dc']].map(([n, h], i) => `<label class="sw"><input type="radio" name="cfg-color" value="${h}" data-name="${n}"${i === 0 ? ' checked' : ''}><span style="--c:${h}"></span><em class="sr">${n}</em></label>`).join('')}</div>
        </fieldset>
        <p class="cfg-sum" aria-live="polite"><b id="cfg-sum">40 ft · New · Orange</b><span>Illustrative preview. Availability and prices on request.</span></p>
        <a class="btn btn--primary" id="cfg-cta" href="contact.html#contact-form">Enquire about this container ${ic('arrow')}</a>
      </form>
      <div class="viewer viewer--cfg rv" style="--d:.1s" data-viewer="container-config" role="group" aria-label="Interactive 3D container preview. Drag to rotate; use the options to change size, condition and colour."></div>
    </div>
  </div>
</section>

<section class="sec sec--paper" aria-labelledby="how-h">
  <div class="wrap">
    <div class="sec__head"><div class="rv"><span class="eyebrow">How we work</span><h2 id="how-h" class="display h2">From enquiry to delivery</h2></div></div>
    <ol class="tl">
      <li class="tl__i rv"><span class="tl__dot">1</span><h3>Tell us your needs</h3><p>Share what you are shipping, where it is going and when it needs to arrive.</p></li>
      <li class="tl__i rv" style="--d:.08s"><span class="tl__dot">2</span><h3>Booking &amp; paperwork</h3><p>We arrange cargo booking with trusted shipping lines and coordinate documentation and customs.</p></li>
      <li class="tl__i rv" style="--d:.16s"><span class="tl__dot">3</span><h3>Moved by sea &amp; road</h3><p>Your cargo travels in our containers or on FCL/LCL space, with trucking where it is needed.</p></li>
      <li class="tl__i rv" style="--d:.24s"><span class="tl__dot">4</span><h3>Delivered to destination</h3><p>Safe, on time, and with clear communication from origin to destination.</p></li>
    </ol>
  </div>
</section>

${portsBlock('sec--navy2')}

${cta}`
});

/* ---------------- CONTACT ---------------- */
const mapLink = q => `https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(q)}`;
page({
  file: 'contact.html', three: true, viewers: true,
  title: 'Contact us — SS Gulf Shipping',
  desc: 'Contact SS Gulf Shipping in Karachi, Lisbon or Dubai for freight forwarding, NVOCC, trucking and container trading quotes.',
  body: `
${pageHero({ img: 'night.webp', h1: 'Contact us', crumb: 'Contact us', view: 'yard', tod: 0.78 })}

<section class="sec sec--paper">
  <div class="wrap">
    <div class="sec__head">
      <div class="rv"><span class="eyebrow">Contact</span><h2 class="display h2">Get in touch with us</h2></div>
      <p class="lead rv" style="--d:.1s">Have questions about our shipping and logistics services? Our team at SS Gulf Shipping is here to assist you with reliable solutions, transparent communication, and timely support for your cargo needs.</p>
    </div>

    <div class="tiles">
      <div class="office rv">
        <h3>${ic('pin')}Karachi, Pakistan</h3>
        <ul><li class="row2"><a href="tel:${PHONE_PK.tel}">${ic('phone')}${PHONE_PK.show}</a><button type="button" class="copy" data-copy="${PHONE_PK.show}" aria-label="Copy Karachi phone number">Copy</button></li><li class="clock">${ic('clock')}Local time <b data-tz="Asia/Karachi">--:--</b></li>
        <li><a href="${mapLink('Karachi, Pakistan')}" target="_blank" rel="noopener">${ic('arrow')}View on map</a></li></ul>
      </div>
      <div class="office rv" style="--d:.08s">
        <h3>${ic('pin')}Lisbon, Portugal</h3>
        <ul><li class="row2"><a href="tel:${PHONE_PT.tel}">${ic('phone')}${PHONE_PT.show}</a><button type="button" class="copy" data-copy="${PHONE_PT.show}" aria-label="Copy Lisbon phone number">Copy</button></li><li class="clock">${ic('clock')}Local time <b data-tz="Europe/Lisbon">--:--</b></li>
        <li><a href="${mapLink('Lisbon, Portugal')}" target="_blank" rel="noopener">${ic('arrow')}View on map</a></li></ul>
      </div>
      <div class="office rv" style="--d:.16s">
        <h3>${ic('pin')}Dubai, UAE</h3>
        <ul><li><a href="mailto:${EMAILS[0]}">${ic('mail')}Reach us by email</a></li><li class="clock">${ic('clock')}Local time <b data-tz="Asia/Dubai">--:--</b></li>
        <li><a href="${mapLink('Dubai, UAE')}" target="_blank" rel="noopener">${ic('arrow')}View on map</a></li></ul>
      </div>
      <div class="office rv" style="--d:.24s">
        <h3>${ic('mail')}Email</h3>
        <ul>${EMAILS.map(e => `<li class="row2"><a href="mailto:${e}">${e}</a><button type="button" class="copy" data-copy="${e}" aria-label="Copy ${e}">Copy</button></li>`).join('')}</ul>
      </div>
    </div>

    <div class="contact2">
      <form id="contact-form" class="form rv" novalidate>
        <h2 class="display">Request a quote</h2>
        <p>Tell us about your shipment and we will get back to you.</p>
        <div class="grid2">
          <div class="field"><label for="fname">First name <em aria-hidden="true">*</em></label><input id="fname" name="fname" type="text" autocomplete="given-name" required aria-describedby="fname-err"><span class="err" id="fname-err" role="alert"></span></div>
          <div class="field"><label for="lname">Last name <em aria-hidden="true">*</em></label><input id="lname" name="lname" type="text" autocomplete="family-name" required aria-describedby="lname-err"><span class="err" id="lname-err" role="alert"></span></div>
        </div>
        <div class="grid2">
          <div class="field"><label for="email">Email <em aria-hidden="true">*</em></label><input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-err"><span class="err" id="email-err" role="alert"></span></div>
          <div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="Optional"></div>
        </div>
        <div class="field"><label for="service">Service</label>
          <select id="service" name="service">
            <option>Freight Forwarding</option><option>NVOCC</option><option>Trucking</option><option>Container Trading</option><option>Other</option>
          </select></div>
        <div class="field"><label for="message">Your message <em aria-hidden="true">*</em></label><textarea id="message" name="message" required aria-describedby="message-err" placeholder="Origin, destination, cargo type, container size…"></textarea><span class="err" id="message-err" role="alert"></span></div>
        <button class="btn btn--primary" type="submit">Send message ${ic('arrow')}</button>
        <div class="status" id="form-status" role="status" aria-live="polite" hidden></div>
        <p class="note">This opens your email app with the message ready to send to <a href="mailto:${EMAILS[0]}">${EMAILS[0]}</a>. Prefer to talk? Call <a href="tel:${PHONE_PT.tel}">${PHONE_PT.show}</a>.</p>
      </form>

      <aside class="contact2__aside rv" style="--d:.1s" aria-label="Our offices">
        <div class="viewer viewer--offices" data-viewer="globe-offices" role="group" aria-label="Interactive 3D globe linking our offices in Karachi, Lisbon and Dubai. Drag or use the arrow keys to rotate."><span class="vcap">Karachi <b>⇄</b> Lisbon <b>⇄</b> Dubai</span></div>
        <p class="hours-card">${ic('clock')}<span>${HOURS}</span></p>
      </aside>
    </div>
  </div>
</section>
`
});

/* ---------------- LEGAL (drafts, review before publishing) ---------------- */
const legalHead = (h1, crumb, view, tod, img = 'hero.jpg') => pageHero({ img, h1, crumb, view, tod });
const legalLayout = (inner) => {
  const items = [];
  inner = inner.replace(/<h2>([^<]+)<\/h2>/g, (m, t) => { const id = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); items.push([id, t]); return '<h2 id="' + id + '">' + t + '</h2>'; });
  return '<section class="sec sec--paper"><div class="wrap legal-grid"><nav class="toc" aria-label="On this page"><span class="eyebrow">On this page</span><ol>' + items.map(([id, t]) => '<li><a href="#' + id + '">' + t + '</a></li>').join('') + '</ol></nav><div class="prose legal">' + inner + '</div></div></section>';
};

page({
  file: 'privacy.html', three: true,
  title: 'Privacy Policy — SS Gulf Shipping',
  desc: 'How SS Gulf Shipping collects, uses and protects personal information submitted through this website.',
  body: `
${legalHead('Privacy Policy', 'Privacy Policy', 'ship', 0.55)}
${legalLayout(`
  <p class="upd">Last updated: 23 November 2026</p>
  <h2>Who we are</h2>
  <p>${SITE} (“we”, “us”) is a freight forwarding and logistics company with offices in Karachi, Pakistan; Lisbon, Portugal; and Dubai, UAE. You can reach us at <a href="mailto:${EMAILS[0]}">${EMAILS[0]}</a>.</p>
  <h2>What we collect</h2>
  <p>When you contact us through this website, by email or by phone, we collect the details you give us: your name, email address, phone number, the service you are interested in, and the content of your message, including shipment details.</p>
  <h2>How we use it</h2>
  <ul><li>To reply to your enquiry and prepare quotes.</li><li>To arrange and manage shipments you ask us to handle.</li><li>To meet legal, customs and regulatory obligations that apply to shipping.</li></ul>
  <h2>Who we share it with</h2>
  <p>We do not sell personal information. We share it only where needed to carry out your request, for example with shipping lines, customs authorities and transport partners, or where the law requires it.</p>
  <h2>How long we keep it</h2>
  <p>We keep enquiry and shipment records only as long as needed for the purposes above and to meet legal and accounting requirements.</p>
  <h2>Your rights</h2>
  <p>Depending on where you live, you may have the right to access, correct or delete your personal information, to object to or restrict how we use it, and to complain to your local data protection authority. To use these rights, email us at <a href="mailto:${EMAILS[0]}">${EMAILS[0]}</a>.</p>
  <h2>Cookies and analytics</h2>
  <p>This website does not use advertising cookies. If we add analytics in future, we will update this policy.</p>
  <h2>Changes</h2>
  <p>We may update this policy from time to time. The date above shows when it last changed.</p>
`)}
${cta}`
});

page({
  file: 'terms.html', three: true,
  title: 'Terms & Conditions — SS Gulf Shipping',
  desc: 'Terms for using the SS Gulf Shipping website and how quotes and shipments are handled.',
  body: `
${legalHead('Terms &amp; Conditions', 'Terms &amp; Conditions', 'crane', 0.2)}
${legalLayout(`
  <p class="upd">Last updated: 23 November 2026</p>
  <h2>Using this website</h2>
  <p>By using this website you agree to these terms. The site gives general information about the services of ${SITE}. It is not an offer, and nothing on it creates a contract for the carriage of goods.</p>
  <h2>Quotes and bookings</h2>
  <p>Quotes are provided on request and depend on the cargo, route, carrier space and prevailing market conditions. A shipment is accepted only when we confirm it in writing. Shipments are handled under the booking terms we agree with you for that shipment.</p>
  <h2>Accuracy of information</h2>
  <p>We take care to keep information accurate, but we do not guarantee that the site is complete or free of errors. Service availability, ports and routes can change.</p>
  <h2>Your responsibilities</h2>
  <ul><li>Give accurate and complete cargo, documentation and contact information.</li><li>Do not ask us to move goods that are prohibited or restricted without the required permits.</li></ul>
  <h2>Third-party links</h2>
  <p>This site may link to other websites, such as maps. We are not responsible for their content or privacy practices.</p>
  <h2>Limitation of liability</h2>
  <p>To the extent the law allows, we are not liable for loss arising from the use of this website. Liability for shipments is governed by the booking terms and applicable transport conventions.</p>
  <h2>Governing law</h2>
  <p>The governing law and jurisdiction for each shipment are stated in the booking terms agreed for it.</p>
  <h2>Contact</h2>
  <p>Questions about these terms: <a href="mailto:${EMAILS[0]}">${EMAILS[0]}</a>.</p>
`)}
${cta}`
});

