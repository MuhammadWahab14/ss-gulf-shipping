/* SS Gulf Shipping: interactive 3D object viewers (truck, ship, containers, port globe).
   One shared WebGL renderer draws every visible viewer into its own 2D canvas, so there is only a single extra
   context no matter how many viewers a page has. Drag / arrow keys rotate. Falls back to the photo or icon beneath. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const els = [...document.querySelectorAll('[data-viewer]')];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const rand = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

async function init() {
  if (navigator.connection && navigator.connection.saveData) return;
  const reduce = document.documentElement.classList.contains('reduce');
  const dpr = Math.min(window.devicePixelRatio || 1, matchMedia('(max-width: 860px)').matches ? 1.25 : 1.6);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true }); } catch (e) { return; }
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  try { await Promise.race([document.fonts.load('800 100px "Exo 2"'), sleep(900)]); } catch (e) { /* system font */ }

  /* ---------- shared pieces ---------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const CL = 12.19, CH = 2.59, CW = 2.44;
  const contGeo = (() => {
    const parts = []; const add = (g, x, y, z, s) => { g.deleteAttribute('uv'); g.translate(x, y, z); const n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(s), 3)); parts.push(g); };
    add(new THREE.BoxGeometry(CL, CH, CW - 0.1), 0, CH / 2, 0, 1);
    const ribs = 10, pitch = (CL - 1.1) / ribs;
    for (let i = 0; i < ribs; i++) for (const s of [-1, 1]) add(new THREE.BoxGeometry(pitch * 0.52, CH - 0.34, 0.12), -CL / 2 + 0.55 + pitch * (i + 0.5), CH / 2, s * (CW / 2), 0.9);
    for (const x of [-1, 1]) for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.2, CH, 0.2), x * (CL / 2 - 0.1), CH / 2, z * (CW / 2 - 0.1), 0.6);
    add(new THREE.BoxGeometry(CL, 0.16, CW), 0, CH - 0.08, 0, 0.72); add(new THREE.BoxGeometry(CL, 0.16, CW), 0, 0.08, 0, 0.6);
    for (const z of [-0.32, 0.32]) add(new THREE.BoxGeometry(0.1, CH - 0.45, 0.07), CL / 2 + 0.03, CH / 2, z, 0.5);
    return mergeGeometries(parts);
  })();
  const decal = (fg) => { const c = document.createElement('canvas'); c.width = 1024; c.height = 200; const g = c.getContext('2d'); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 124px "Exo 2","Arial Black",Impact,sans-serif'; g.fillText('SS GULF SHIPPING', 512, 96); g.fillRect(70, 168, 884, 8); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const decalGeo = new THREE.PlaneGeometry(9.2, 1.8);
  const decalOnOrange = new THREE.MeshStandardMaterial({ map: decal('#0A1B33'), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const decalOnNavy = new THREE.MeshStandardMaterial({ map: decal('#F37021'), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const contMat = (hex) => new THREE.MeshStandardMaterial({ vertexColors: true, color: hex, roughness: 0.55, metalness: 0.3 });
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();

  function branded(hex, parent, x, y, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    g.add(new THREE.Mesh(contGeo, contMat(hex)));
    const orange = hex === 0xF37021;
    if (orange || hex === 0x0F2747) for (const s of [-1, 1]) { const d = new THREE.Mesh(decalGeo, orange ? decalOnOrange : decalOnNavy); d.position.set(0, CH / 2, s * (CW / 2 + 0.07)); if (s < 0) d.rotation.y = Math.PI; g.add(d); }
    parent.add(g); return g;
  }

  /* ---------- models (each returns a group; fit() normalises size and centre) ---------- */
  function buildContainer() { const g = new THREE.Group(); branded(0xF37021, g, 0, 0, 0); return g; }

  function buildStack() {
    const g = new THREE.Group(), r = rand(8), cols = [0xF37021, 0x0F2747, 0x1f4e8c, 0xa63d2f, 0x2d6a6a, 0xe0a526, 0x7a8590];
    for (let row = 0; row < 3; row++) for (let lv = 0; lv < (row === 1 ? 3 : 2); lv++) {
      const hex = row === 1 && lv === 0 ? 0xF37021 : cols[Math.floor(r() * cols.length)];
      branded(hex, g, 0, lv * CH, (row - 1) * (CW + 0.35), 0);
    }
    return g;
  }

  function buildTruck() {
    const g = new THREE.Group();
    const M = (o) => new THREE.MeshStandardMaterial(o), B = (c) => new THREE.MeshBasicMaterial({ color: c });
    const navy = M({ color: 0x14284b, metalness: 0.7, roughness: 0.3 }), pearl = M({ color: 0xeef2f7, metalness: 0.35, roughness: 0.3 });
    const dark = M({ color: 0x0a0d12, metalness: 0.8, roughness: 0.4 }), glass = M({ color: 0x05080d, metalness: 1, roughness: 0.06 });
    const rubber = M({ color: 0x07080a, roughness: 0.9 }), chrome = M({ color: 0x9aa7b8, metalness: 1, roughness: 0.2 });
    const put = (geo, mat, x, y, z, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); g.add(m); return m; };
    put(new THREE.BoxGeometry(19.2, 0.38, 1.1), dark, -5.6, 1.05, 0);
    const shp = new THREE.Shape([[-1.7, 1.15], [3.55, 1.15], [3.85, 1.75], [3.62, 3.35], [2.55, 3.95], [0.5, 4.05], [-1.7, 4.05]].map(([x, y]) => new THREE.Vector2(x, y)));
    const cab = new THREE.ExtrudeGeometry(shp, { depth: 2.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2, curveSegments: 1 }); cab.translate(0, 0, -1.15);
    put(cab, pearl, 0, 0, 0);
    put(new THREE.BoxGeometry(1.3, 0.05, 2.15), glass, 3.07, 3.65, 0, [0, 0, -0.51]);
    for (const s of [-1, 1]) put(new THREE.BoxGeometry(1.5, 0.75, 0.04), glass, 1.6, 3.25, s * 1.3);
    const fair = new THREE.ExtrudeGeometry(new THREE.Shape([[0.6, 4.05], [-1.6, 4.05], [-1.6, 4.85]].map(([x, y]) => new THREE.Vector2(x, y))), { depth: 2.2, bevelEnabled: false }); fair.translate(0, 0, -1.1);
    put(fair, pearl, 0, 0, 0);
    put(new THREE.BoxGeometry(13.8, 2.95, 2.5), navy, -8.8, 2.98, 0);
    for (const s of [-1, 1]) {
      put(new THREE.BoxGeometry(11, 0.7, 0.05), dark, -7.6, 1.2, s * 1.3);
      put(new THREE.BoxGeometry(13.4, 0.08, 0.03), B(0xF37021), -8.8, 1.78, s * 1.27);
      put(new THREE.BoxGeometry(5.0, 0.07, 0.03), B(0xF37021), 0.9, 1.5, s * 1.27);
      put(new THREE.BoxGeometry(0.1, 0.22, 0.5), B(0xfff6dc), 3.88, 1.6, s * 0.85);
      put(new THREE.BoxGeometry(0.1, 0.2, 0.4), B(0xff2a1a), -15.72, 1.7, s * 1.0);
      const d = new THREE.Mesh(decalGeo, decalOnNavy); d.scale.set(0.95, 0.95, 1); d.position.set(-8.8, 3.3, s * 1.275); if (s < 0) d.rotation.y = Math.PI; g.add(d);
      put(new THREE.BoxGeometry(0.08, 0.7, 0.35), dark, 3.2, 3.1, s * 1.55);
      put(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 16).rotateZ(Math.PI / 2), chrome, 0.6, 0.95, s * 1.2);
      put(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 10), chrome, -1.45, 3.5, s * 1.3);
    }
    const tire = new THREE.CylinderGeometry(0.55, 0.55, 0.34, 22).rotateX(Math.PI / 2), hub = new THREE.CylinderGeometry(0.3, 0.3, 0.36, 14).rotateX(Math.PI / 2);
    const wheel = (x, z) => { put(tire, rubber, x, 0.55, z); put(hub, chrome, x, 0.55, z); };
    for (const s of [-1, 1]) { wheel(2.55, s * 1.05); for (const x of [-0.2, -1.4, -12.8, -14.0]) { wheel(x, s * 0.95); wheel(x, s * 1.33); } }
    return g;
  }

  function buildShip() {
    const g = new THREE.Group();
    const half = (x) => (x < -100 ? 15 + 4 * Math.sqrt(Math.max(0, 1 - Math.pow((-100 - x) / 15, 2))) : x < 60 ? 19 : 19 * Math.pow(Math.max(0, 1 - (x - 60) / 75), 0.65));
    const xs = []; for (let x = -115; x <= 135.01; x += 5) xs.push(x);
    const shape = new THREE.Shape(); xs.forEach((x, i) => (i ? shape.lineTo(x, 24 + half(x)) : shape.moveTo(x, 24 + half(x)))); for (let i = xs.length - 1; i >= 0; i--) shape.lineTo(xs[i], 24 - half(xs[i]));
    const ext = (depth, y, mats) => { const e = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }); e.rotateX(-Math.PI / 2); const m = new THREE.Mesh(e, mats); m.position.y = y; g.add(m); };
    const red = new THREE.MeshStandardMaterial({ color: 0x8a2a22, roughness: 0.7, metalness: 0.15 }), navy = new THREE.MeshStandardMaterial({ color: 0x2b4f86, roughness: 0.55, metalness: 0.12 }), deck = new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.85 });
    ext(9, -12, [red, red]); ext(12, -3, [deck, navy]);
    const white = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.7 }), glass = new THREE.MeshStandardMaterial({ color: 0x0a1a30, roughness: 0.25, metalness: 0.6, emissive: 0xffc878, emissiveIntensity: 0.6 }), orange = new THREE.MeshStandardMaterial({ color: 0xe8691f, roughness: 0.55, metalness: 0.3 });
    const box = (w, h, d, x, y, z, m) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.position.set(x, y, z); g.add(q); };
    for (let i = 0; i < 5; i++) { box(22 - i * 1.5, 4.4, 34 - i * 1.2, -92 + i * 0.4, 11.2 + i * 4.4, -24, white); box(0.3, 1.1, 30 - i, -81.2 + i * 0.4 - 0.3, 11.4 + i * 4.4, -24, glass); }
    box(7, 3, 38, -88.5, 34.5, -24, white);
    const fn = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 12, 20), orange); fn.position.set(-96, 41, -24); g.add(fn);
    const r = rand(33), list = [], cols = [0xa63d2f, 0x1f4e8c, 0x2d6a6a, 0xc9822b, 0x7a8590, 0xe7e4dc, 0x3a6b3a, 0xF37021, 0x0F2747];
    for (let b = 0; b < 12; b++) for (let row = 0; row < 12; row++) { const h = 3 + Math.floor(r() * 3) - (b > 9 ? 2 : 0); for (let k = 0; k < Math.max(1, h); k++) list.push({ x: -60 + b * 13.2, y: 9 + k * CH, z: -24 + (row - 5.5) * 2.7, c: cols[Math.floor(r() * cols.length)] }); }
    const inst = new THREE.InstancedMesh(contGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.22 }), list.length); const mt = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach((it, i) => { mt.makeTranslation(it.x, it.y, it.z); inst.setMatrixAt(i, mt); inst.setColorAt(i, c.set(it.c)); }); g.add(inst);
    return g;
  }

  const PORTS = [['Karachi', 24.86, 67.0], ['Jebel Ali', 25.0, 55.06], ['Sohar', 24.37, 56.73], ['Mundra', 22.74, 69.7], ['Nhava Sheva', 18.95, 72.95], ['Chittagong', 22.33, 91.8], ['Hamburg', 53.55, 9.99], ['All over Europe', 47.5, 14.5], ['Laem Chabang', 13.08, 100.88], ['Bangkok', 13.7, 100.5], ['Haiphong', 20.85, 106.7]];
  function buildGlobe(mode) {
    const g = new THREE.Group(), R = 2, offices = mode === 'offices', LON_C = offices ? 29 : 75;
    const ll = (lat, lon, r = R) => { const la = lat * Math.PI / 180, th = (lon - LON_C) * Math.PI / 180; return V(r * Math.cos(la) * Math.sin(th), r * Math.sin(la), r * Math.cos(la) * Math.cos(th)); };
    const pts = [], seg = 64;
    for (let lat = -75; lat <= 75; lat += 15) for (let i = 0; i < seg; i++) { const a = ll(lat, i / seg * 360), b = ll(lat, (i + 1) / seg * 360); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    for (let lon = 0; lon < 360; lon += 15) for (let i = 0; i < 32; i++) { const a = ll(-90 + i / 32 * 180, lon), b = ll(-90 + (i + 1) / 32 * 180, lon); pts.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x6fd0e0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false })));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.992, 48, 32), new THREE.ShaderMaterial({ vertexShader: 'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vP=mv.xyz;gl_Position=projectionMatrix*mv;}', fragmentShader: 'varying vec3 vN;varying vec3 vP;void main(){vec3 n=normalize(vN);float d=max(dot(n,normalize(-vP)),0.0);float f=pow(1.0-d,3.2);vec3 c=mix(vec3(0.05,0.14,0.22),vec3(0.085,0.25,0.34),smoothstep(-0.4,1.0,n.y*0.6+0.5));c+=vec3(0.16,0.55,0.66)*f*1.05;gl_FragColor=vec4(c,1.0);}' })));
    /* continents as a dotted land mask (1.5 degree cells) */
    { const LM = atob('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAfwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPj/z////3EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/++f///w8AAPADgAEAAOADAAAAAAAAAAAAAAAg3N4f/v///wcAAB8AAAAAAAA4AAAAAAAAAAAAAAADAOAH/P///wcAAA4AAAAAAAAwAAAAAAAAAAAAAAC8cQwBAP///wcAAAAAAIAHAMD/DwDwAAAAAAAAAOAAAAAAAPz//wMAAAAAAGAAAPz/AQAAAAAAAAAAAOBdc/MDAPj//wEAAAAAABjAwP///z9gAAAAA4AAAED8A/P/AOD//////////zjg/v///z//HwAAAPj/A0/8X4PwB/D//wAAAOA/AADh/v///////wM+/P///////////////////wMAnBMgAgAAAAAAAAAAyP///////////////////wEAOAAAAQAAAAAAAAAA5////////////////////8CBBwAAAAAAAAAAAAAAAOD//////88GH8AfAAwAwJ////////////////9/APz//////wNxDIAPAAAA8M///////////////98/APzf/////wHwAwAGAAAA+M///////////////+ADAPAB+P///wHwMwAAAAAA8A//////////////ZBgAAIACgP///wPgfwAAAAAQAAf///////////8fAA4AACAAAP///z/gfwAAAAAwYMf///////////8PAB8AAAQAAP7////5/wMAAABoQOj///////////8DAA8AAAAAgPz////5/wcAAADs+P////////////9/AAcAAAAAAPj////7/wMAAADg+f////////////9/AAEAAAAAAPj/////zwAAAAAw/v////////////+/AAAAAAAAAPD/////Gw4AAACg//////////////8fAAAAAAAAAOD/////HxAAAADA//////////////8fAAAAAAAAAOD//////wAAAACA//9P/vj///////8PAAAAAAAAAOD/////EwAAAACA//wHfPz////////HAAAAAAAAAOD/////AQAAAAD8g/EH8Pj////////gAAAAAAAAAOD/////AAAAAAD8Aebn+fH//////z8AAAAAAAAAAOD///9/AAAAAAD8AGT8//H//////xpgAAAAAAAAAMD///8/AAAAAAD8AMT8//H/////fzggAAAAAAAAAID///8fAAAAAABwdAD8/////////zE4AAAAAAAAAID///8fAAAAAACwfwBD/////////zA/AAAAAAAAAAD+//8PAAAAAAD4fwAA/////////wAHAAAAAAAAAAD8//8DAAAAAAD8/2OA/////////4EAAAAAAAAAAADo//8DAAAAAAD8/+///////////wEAAAAAAAAAAADo/wkCAAAAAAD+//////z//////wEAAAAAAAAAAADYfwACAAAAAID///8///n//////wEAAAAAAAAAAACgfwAWAAAAAMD///9//+H//////wAAAAAAAAAAAAAgfwAAAAAAAMD///9//jPg////fwAAAAAAAAAAAAAAfgAAAAAAAOD//////H/A////PwEAAAAAAAAAAAAAfAAIAAAAAOD//////f/A/+f/BwAAAAAAAAAAAAAAfDBwAAAAAOD/////+X8A/sN/AAAAAAAAAAAAAAAA+DgAAwAAAOD/////+T8A/oB/AwAAAAAAAAAAAAAA4B8AAAAAAOD/////8x8AfoB/AAMAAAAAAAAAAAAAgPwAAAAAAOD/////8wcAPoD+AAEAAAAAAAAAAAAAAPgBAAAAAOD/////7wEAHAD+AQEAAAAAAAAAAAAAAMAAAAAAAOD/////PwAAHAD8AQQAAAAAAAAAAAAAAICAAgAAAMD/////HwMAGADgAAoAAAAAAAAAAAAAAADBfgAAAID//////wMAGABAAAAAAAAAAAAAAAAAAADy/wAAAID//////wEAIAAGAAwAAAAAAAAAAAAAAADw/wEAAAD//////wEAIAAIAAgAAAAAAAAAAAAAAADw/x8AAAD8+P///wAAAAAZYAAAAAAAAAAAAAAAAADg/z8AAAAAwP///wAAAAAbMAAAAAAAAAAAAAAAAADw/z8AAAAAwP//fwAAAAAWfAAAAAAAAAAAAAAAAAD4/38AAAAAwP//HwAAAAAcficAAAAAAAAAAAAAAAD8//8BAAAAwP//DwAAAAAYPiABAAAAAAAAAAAAAAD8//8DAAAAwP//BwAAAAA4vgEaAAAAAAAAAAAAAAD8//8/AAAAgP//BwAAAABwEBL+AAAAAAAAAAAAAAD8////AAAAAP//AwAAAABgAADwAQAAAAAAAAAAAAD8////AQAAAP//AwAAAADABADyAwEAAAAAAAAAAAD4////AQAAAP7/AwAAAAAAHADwBgQAAAAAAAAAAADw////AAAAAP7/BwAAAAAAAAQADAAAAAAAAAAAAADw//9/AAAAAP7/BwAAAAAAAAAAAAAAAAAAAAAAAADg//9/AAAAAP7/BwAAAAAAAICHAAAAAAAAAAAAAADg//8/AAAAAP//BwEAAAAAANDHAAAAAAAAAAAAAADA//8/AAAAAP//hwMAAAAAAPjHAQAAAAAAAAAAAAAA//8/AAAAAP//4QEAAAAAAPzfAQAAAAAAAAAAAAAA/v8/AAAAAP//4AEAAAAAAP7/AwAAAAAAAAAAAAAA/v8fAAAAAP5/wAAAAAAAgP//ByAAAAAAAAAAAAAA/v8fAAAAAP7/4AAAAAAA4P//D0AAAAAAAAAAAAAA/v8HAAAAAPz/4AAAAAAA8P//HwAAAAAAAAAAAAAA/v8AAAAAAPx/YAAAAAAA8P//PwAAAAAAAAAAAAAA/v8AAAAAAPw/AAAAAAAA8P//PwAAAAAAAAAAAAAA/v8AAAAAAPw/AAAAAAAA8P//PwAAAAAAAAAAAAAA/38AAAAAAPgfAAAAAAAA4P//PwAAAAAAAAAAAAAA/z8AAAAAAPAPAAAAAAAA4P//PwAAAAAAAAAAAAAA/x8AAAAAAPAHAAAAAAAA4B/+PwAAAAAAAAAAAAAA/w8AAAAAAPABAAAAAAAA4Af0HwAAAAAAAAAAAAAA/wMAAAAAAAAAAAAAAAAAAADwDwAIAAAAAAAAAACA/wMAAAAAAAAAAAAAAAAAAADgDwAQAAAAAAAAAACA/wEAAAAAAAAAAAAAAAAAAADAAgBwAAAAAAAAAACAfwAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAACAHwAAAAAAAAAAAAAAAAAAAAAABgAQAAAAAAAAAACAHwAAAAAAAAAAAAAAAAAAAAAABgAMAAAAAAAAAADADwAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAADABwAAAAAAAAAAAAAAAAAAAAAAAIADAAAAAAAAAADADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAgwEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAADwAAAR4Pv4HAAAAAAAAAAAAAAAACAAAAAAAAAAA4P8/4P//////BwAAAAAAAAAAAAAAPwAAAAAAAADg//8//P///////wMAAAAAAAAAAACAewAAAADI/v////8///////////8BAAAAAAAAABAAeAAAAID///////////////////8DAAAAAAAe4P//fwAAAMD//////////////////38AAADA////////BwAAAPz//////////////////x8AAEDz//////8/AAAA8P///////////////////x8AABj///////8PAIAH/////////////////////38AAADA//////8/gPAD4P///////////////////wcAAAD+////////P4Dx/////////////////////w8AAAD8//////////////////////////////////8AAPz/AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), LW = 240, LH = 120, lp = [];
      for (let j = 0; j < LH; j += 2) for (let i = 0; i < LW; i += 2) { const k = j * LW + i; if ((LM.charCodeAt(k >> 3) >> (k & 7)) & 1) { const v = ll(90 - (j + 0.5) * 1.5, -180 + (i + 0.5) * 1.5, R * 1.003); lp.push(v.x, v.y, v.z); } }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      const dc = document.createElement('canvas'); dc.width = dc.height = 32; const dg = dc.getContext('2d'); dg.fillStyle = '#fff'; dg.beginPath(); dg.arc(16, 16, 13, 0, 7); dg.fill();
      g.add(new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.07, map: new THREE.CanvasTexture(dc), alphaTest: 0.4, color: 0xd9b46a, transparent: true, opacity: 0.92, depthWrite: false }))); }
    const r = rand(5), sp = new Float32Array(2600 * 3);
    for (let i = 0; i < 2600; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u), rr = R * (1.004 + r() * 0.03); sp[i * 3] = rr * q * Math.cos(a); sp[i * 3 + 1] = rr * u; sp[i * 3 + 2] = rr * q * Math.sin(a); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.035, map: glowTex, color: 0x9fdcff, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })));
    const pins = [], baseArcs = [];
    const pin = (name, lat, lon, hex, size) => { const p = ll(lat, lon), big = size > 0.15, s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.copy(p).multiplyScalar(1.012); s.scale.setScalar(size); g.add(s); const hd = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.062 : 0.045, 14, 10), new THREE.MeshBasicMaterial({ color: hex })); hd.position.copy(p).multiplyScalar(1.01); g.add(hd); const rg = new THREE.Mesh(new THREE.RingGeometry(big ? 0.085 : 0.063, big ? 0.098 : 0.074, 28), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); rg.position.copy(p).multiplyScalar(1.011); rg.lookAt(p.clone().multiplyScalar(2)); g.add(rg); pins.push({ name, p, sprite: s, base: size, hex }); return p; };
    const arcPts = (a, b, lift, N) => { const A = a.clone().normalize(), Bv = b.clone().normalize(), ang = A.angleTo(Bv), arr = []; for (let k = 0; k <= N; k++) { const t = k / N; arr.push(A.clone().lerp(Bv, t).normalize().multiplyScalar(R * (1.03 + Math.sin(Math.PI * t) * (lift + ang * 0.2)))); } return arr; };
    const arc = (a, b, hex, lift) => { const m = new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPts(a, b, lift, 56)), m)); baseArcs.push(m); };
    if (offices) {
      PORTS.forEach(([n, la, lo]) => pin(n, la, lo, 0x35d0e8, 0.1));
      const k = pin('Karachi (office)', 24.86, 67.0, 0xf2c14e, 0.2), l = pin("Lisbon (office)", 38.72, -9.14, 0xf2c14e, 0.2); arc(l, k, 0xe0b45a, 0.14);
    } else {
      const hub = ll(24.86, 67.0); PORTS.forEach(([n, la, lo], i) => { const p = pin(n, la, lo, i === 0 ? 0xf2c14e : 0x35d0e8, i === 0 ? 0.18 : 0.1); if (i) arc(hub, p, 0xe0b45a, 0.12); });
    }

    /* interactive route (set from the planner on the page) */
    const routeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffe2bd, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    routeLine.visible = false; routeLine.frustumCulled = false; g.add(routeLine);
    const pulses = [0, 1, 2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.3); s.visible = false; g.add(s); return s; });
    let routePts = null;
    const api = {
      pins, focus: null, animating: false,
      tick(dt, now) { if (!routePts) return; for (let i = 0; i < 3; i++) { const q = (now * 0.00028 + i / 3) % 1, idx = Math.min(routePts.length - 1, Math.floor(q * (routePts.length - 1))); pulses[i].position.copy(routePts[idx]); pulses[i].material.opacity = Math.sin(Math.PI * q); } },
      setRoute(fromName, toName) {
        const a = pins.find((x) => x.name === fromName), b = pins.find((x) => x.name === toName), on = !!(a && b && a !== b);
        pins.forEach((pn) => { const sel = pn === a || pn === b; pn.sprite.scale.setScalar(sel ? pn.base * 1.9 : pn.base); pn.sprite.material.color.setHex(sel ? (pn === a ? 0xffd27a : 0x9ff3ff) : pn.hex); pn.sel = sel; });
        baseArcs.forEach((m) => { m.opacity = on ? 0.2 : 0.85; });
        routeLine.visible = on; pulses.forEach((p) => { p.visible = on; });
        if (!on) { routePts = null; api.focus = a ? a.p.clone().normalize() : (b ? b.p.clone().normalize() : null); return api.focus; }
        routePts = arcPts(a.p, b.p, 0.1, 64); routeLine.geometry.dispose(); routeLine.geometry = new THREE.BufferGeometry().setFromPoints(routePts);
        api.focus = a.p.clone().add(b.p).normalize(); return api.focus;
      }
    };
    const LBL = offices ? { 'Karachi (office)': ['pk', 'Karachi'], 'Lisbon (office)': ['pt', 'Lisbon'] } : { Karachi: ['pk', 'Karachi \u00b7 Office', 1], 'Jebel Ali': ['ae', 'Jebel Ali'], Sohar: ['om', 'Sohar'], Hamburg: ['de', 'Hamburg'], 'All over Europe': ['eu', 'All over Europe'], 'Nhava Sheva': ['in', 'Nhava Sheva'], 'Laem Chabang': ['th', 'Laem Chabang'], Chittagong: ['bd', 'Chittagong'], Haiphong: ['vn', 'Haiphong'], Bangkok: ['th', 'Bangkok'], Mundra: ['in', 'Mundra'] };
    api.labels = Object.keys(LBL).map((n) => ({ pin: pins.find((x) => x.name === n), cc: LBL[n][0], text: LBL[n][1], hq: !!LBL[n][2] })).filter((x) => x.pin);
    g.userData.api = api;
    g.rotation.y = offices ? -0.1 : -0.55;
    return g;
  }

  /* container whose size, colour and condition follow the on-page builder */
  const ORG = new THREE.Color(0xF37021), NVY = new THREE.Color(0x0F2747), RUST = new THREE.Color(0x5a3a28);
  const cdist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);   // THREE.Color has no distanceTo
  function buildContainerConfig() {
    const g = new THREE.Group(), mat = contMat(0xF37021), mesh = new THREE.Mesh(contGeo, mat); g.add(mesh);
    const decals = []; for (const s of [-1, 1]) { const d = new THREE.Mesh(decalGeo, decalOnOrange); d.position.set(0, CH / 2, s * (CW / 2 + 0.07)); if (s < 0) d.rotation.y = Math.PI; g.add(d); decals.push(d); }
    const st = { color: new THREE.Color(0xF37021), len: 1, used: 0 }, goal = { color: new THREE.Color(0xF37021), len: 1, used: 0 }, tmp = new THREE.Color();
    const paint = () => { tmp.copy(st.color).multiplyScalar(1 - 0.22 * st.used).lerp(RUST, 0.1 * st.used); mat.color.copy(tmp); mat.roughness = 0.55 + 0.3 * st.used; mat.metalness = 0.3 - 0.15 * st.used; };
    const api = {
      animating: false,
      set(o) { if (o.color != null) goal.color.set(o.color); if (o.len != null) goal.len = o.len === 20 ? 0.497 : 1; if (o.used != null) goal.used = o.used ? 1 : 0; api.animating = true; },
      tick(dt) {
        if (!api.animating) return; const k = 1 - Math.exp(-dt * 7);
        st.color.lerp(goal.color, k); st.len += (goal.len - st.len) * k; st.used += (goal.used - st.used) * k;
        mesh.scale.x = st.len; const ds = 0.55 + 0.45 * st.len; const brand = cdist(st.color, ORG) < 0.06 ? decalOnOrange : cdist(st.color, NVY) < 0.06 ? decalOnNavy : null;
        decals.forEach((d) => { d.scale.set(ds, ds, 1); d.visible = !!brand && st.used < 0.6; if (brand) d.material = brand; });
        paint();
        if (cdist(st.color, goal.color) < 0.002 && Math.abs(st.len - goal.len) < 0.002 && Math.abs(st.used - goal.used) < 0.002) api.animating = false;
      }
    };
    paint(); g.userData.api = api; return g;
  }

  const BUILDERS = { container: buildContainer, stack: buildStack, truck: buildTruck, ship: buildShip, globe: () => buildGlobe('ports'), 'globe-offices': () => buildGlobe('offices'), 'container-config': buildContainerConfig };
  const SIZES = { container: 4.6, stack: 4.6, truck: 5.4, ship: 5.6, globe: 4.1, 'globe-offices': 4.1, 'container-config': 5.2 };

  /* ---------- viewers ---------- */
  let raf = 0, last = performance.now(), W = 0, H = 0;   // declared before any viewer is measured (request() reads raf)
  const viewers = [];
  const stageLight = () => { const l = new THREE.Group(); l.add(new THREE.HemisphereLight(0x9db6e0, 0x1a2230, 0.7)); const k = new THREE.DirectionalLight(0xffb07a, 2.4); k.position.set(3, 5, 4); const rm = new THREE.DirectionalLight(0x6fd8ff, 1.8); rm.position.set(-4, 3, -3); l.add(k, rm); return l; };
  const discTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(243,112,33,.55)'); gr.addColorStop(0.55, 'rgba(243,112,33,.14)'); gr.addColorStop(1, 'rgba(243,112,33,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();

  els.forEach((el) => {
    const type = el.dataset.viewer, build = BUILDERS[type]; if (!build) return;
    const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = 0.55; scene.add(stageLight());
    const model = build(), pivot = new THREE.Group(), spin = new THREE.Group();
    const bb = new THREE.Box3().setFromObject(model), sz = bb.getSize(V(0, 0, 0)), s = SIZES[type] / Math.max(sz.x, sz.y, sz.z); model.scale.multiplyScalar(s);
    const b2 = new THREE.Box3().setFromObject(model), c = b2.getCenter(V(0, 0, 0)); model.position.sub(c);
    spin.add(model); pivot.add(spin); scene.add(pivot);
    const isGlobe = type.startsWith('globe');
    if (!isGlobe) { const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 64), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); disc.rotation.x = -Math.PI / 2; disc.position.y = b2.min.y - c.y - 0.02; scene.add(disc); const ring = new THREE.Mesh(new THREE.RingGeometry(3.05, 3.09, 96), new THREE.MeshBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = disc.position.y + 0.005; scene.add(ring); }
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const v = { el, type, scene, camera, spin, pivot, model, api: model.userData && model.userData.api, targetYaw: null, targetPitch: 0, routeOn: false, yaw: type === 'truck' ? -0.5 : 0.5, pitch: 0.0, vyaw: 0, dragging: false, moved: 0, visible: false, w: 0, h: 0, cv: document.createElement('canvas'), ready: false, hover: false };
    v.ctx = v.cv.getContext('2d'); v.cv.setAttribute('aria-hidden', 'true');
    el.appendChild(v.cv);   // sits above the fallback image/icon, below the hint (z-index in CSS)
    const hint = document.createElement('span'); hint.className = 'viewer__hint'; hint.setAttribute('aria-hidden', 'true'); hint.textContent = type === 'globe' ? '‹ drag to rotate · tap a port ›' : '‹ drag to rotate ›';   // only the planner globe selects ports el.appendChild(hint);
    if (!el.closest('a')) el.tabIndex = 0;   // card viewers live inside links: keep one tab stop per card
    const fitCam = () => { const a = v.w / Math.max(1, v.h), fov = camera.fov * Math.PI / 180, rad = isGlobe ? 2.05 : (type === 'ship' ? 3.0 : 3.4); const dV = rad / Math.sin(fov / 2), dH = rad / Math.sin(Math.atan(a * Math.tan(fov / 2))); const d = Math.max(dV, dH) / 1.06; camera.aspect = a; camera.position.set(0, d * 0.22, d * 0.975); camera.lookAt(0, isGlobe ? 0 : -0.1, 0); camera.updateProjectionMatrix(); };
    const measure = () => { const r = el.getBoundingClientRect(); v.w = Math.max(2, Math.round(el.clientWidth * dpr)); v.h = Math.max(2, Math.round(el.clientHeight * dpr)); v.cv.width = v.w; v.cv.height = v.h; fitCam(); request(); };
    new ResizeObserver(measure).observe(el); measure();
    new IntersectionObserver((es) => { v.visible = es[0].isIntersecting; if (v.visible) request(); }, { threshold: 0.01, rootMargin: '80px' }).observe(el);

    el.addEventListener('pointerdown', (e) => { v.dragging = true; v.moved = 0; v.lx = e.clientX; v.ly = e.clientY; v.vyaw = 0; v.targetYaw = null; try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer: no capture */ } request(); });
    el.addEventListener('pointermove', (e) => { if (!v.dragging) { if (isGlobe && v.pick) v.showTip(v.pick(e.clientX, e.clientY, 16)); return; } const dx = e.clientX - v.lx, dy = e.clientY - v.ly; v.lx = e.clientX; v.ly = e.clientY; v.moved += Math.abs(dx) + Math.abs(dy); v.yaw += dx * 0.009; v.vyaw = dx * 0.009 * 60; v.pitch = clamp(v.pitch + dy * 0.004, -0.3, 0.4); });
    const up = (e) => { const was = v.dragging; v.dragging = false; if (was && isGlobe && v.moved < 6 && v.pick && e && e.type === 'pointerup') { const hit = v.pick(e.clientX, e.clientY, e.pointerType === 'touch' ? 26 : 16); if (hit) emit('port:select', { name: hit.pn.name }); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerenter', () => { v.hover = true; }); el.addEventListener('pointerleave', () => { v.hover = false; if (v.showTip) v.showTip(null); });
    el.addEventListener('click', (e) => { if (v.moved > 6) { e.preventDefault(); e.stopPropagation(); v.moved = 0; } }, true);
    el.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { v.yaw -= 0.25; request(); e.preventDefault(); } else if (e.key === 'ArrowRight') { v.yaw += 0.25; request(); e.preventDefault(); } });
    if (isGlobe) {
      const tip = document.createElement('div'); tip.className = 'vtip'; tip.setAttribute('aria-hidden', 'true'); el.appendChild(tip);
      const wp = V(0, 0, 0), nd = V(0, 0, 0), cd = V(0, 0, 0);
      v.pick = (cx, cy, radius) => {
        const r = el.getBoundingClientRect(); let best = null, bd = radius * radius; scene.updateMatrixWorld(true);
        for (const pn of v.api.pins) {
          pn.sprite.getWorldPosition(wp); cd.copy(camera.position).sub(wp).normalize(); if (wp.clone().normalize().dot(cd) < 0.08) continue;
          nd.copy(wp).project(camera); const sx = r.left + (nd.x * 0.5 + 0.5) * r.width, sy = r.top + (1 - (nd.y * 0.5 + 0.5)) * r.height, d2 = (sx - cx) * (sx - cx) + (sy - cy) * (sy - cy);
          if (d2 < bd) { bd = d2; best = { pn, sx: sx - r.left, sy: sy - r.top }; }
        }
        return best;
      };
      v.labels = (v.api.labels || []).map((L) => { const e = document.createElement('span'); e.className = 'vlabel' + (L.hq ? ' vlabel--hq' : ''); e.setAttribute('aria-hidden', 'true'); const im = document.createElement('img'); im.alt = ''; im.width = 18; im.height = 13; im.decoding = 'async'; im.src = 'https://flagcdn.com/w40/' + L.cc + '.png'; im.onerror = () => { im.remove(); }; const t = document.createElement('b'); t.textContent = L.text; e.append(im, t); el.appendChild(e); return { L, e, w: 0 }; });
      v.placeLabels = () => {
        const cw = el.clientWidth, ch = el.clientHeight, placed = []; scene.updateMatrixWorld(true);
        for (const it of v.labels) {
          const pn = it.L.pin; pn.sprite.getWorldPosition(wp); cd.copy(camera.position).sub(wp).normalize(); let show = wp.clone().normalize().dot(cd) > 0.2;
          nd.copy(wp).project(camera); const x = (nd.x * 0.5 + 0.5) * cw, y = (1 - (nd.y * 0.5 + 0.5)) * ch;
          if (!it.w) it.w = it.e.offsetWidth || 90; const bx = x, by = y - 34, bw = it.w, bh = 24;
          if (show) for (const q of placed) if (bx < q[0] + q[2] + 4 && bx + bw + 4 > q[0] && by < q[1] + q[3] + 4 && by + bh + 4 > q[1]) { show = false; break; }
          if (bx + bw > cw - 4) show = false;
          if (show) placed.push([bx, by, bw, bh]);
          it.e.style.opacity = show ? 1 : 0; it.e.style.transform = 'translate(' + Math.round(bx) + 'px,' + Math.round(by) + 'px)'; it.e.classList.toggle('is-sel', !!pn.sel);
        }
      };
      v.showTip = (hit) => { if (!hit) { tip.style.opacity = 0; el.style.cursor = ''; return; } tip.textContent = hit.pn.name; tip.style.opacity = 1; tip.style.transform = 'translate(' + (hit.sx + 12) + 'px,' + (hit.sy - 28) + 'px)'; el.style.cursor = 'pointer'; };
    }
    viewers.push(v);
  });

  /* ---------- loop ---------- */
  function request() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function draw(v) {
    if (v.w > W || v.h > H) { W = Math.max(W, v.w); H = Math.max(H, v.h); renderer.setSize(W, H, false); }
    renderer.setViewport(0, 0, v.w, v.h); renderer.setScissor(0, 0, v.w, v.h); renderer.setScissorTest(true);
    renderer.render(v.scene, v.camera);
    if (v.placeLabels) v.placeLabels();
    v.ctx.clearRect(0, 0, v.w, v.h); v.ctx.drawImage(renderer.domElement, 0, renderer.domElement.height - v.h, v.w, v.h, 0, 0, v.w, v.h);
    if (!v.ready) { v.ready = true; v.el.classList.add('is-3d'); }
  }
  function loop(now) {
    raf = 0; const dt = Math.min(0.05, (now - last) / 1000); last = now; let busy = false;
    for (const v of viewers) {
      if (!v.visible) continue;
      try { if (v.api && v.api.tick) v.api.tick(dt, now); } catch (err) { console.warn('[viewers] animation failed for', v.type, err); v.api.tick = null; v.api.animating = false; }   // one viewer must never freeze the others
      if (!v.dragging) {
        v.yaw += v.vyaw * dt; v.vyaw *= Math.exp(-dt * 3.2); if (Math.abs(v.vyaw) < 0.02) v.vyaw = 0;
        if (v.targetYaw != null) { let dd = v.targetYaw - v.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); const kk = 1 - Math.exp(-dt * 3.2); v.yaw += dd * kk; v.pitch += (v.targetPitch - v.pitch) * kk; if (Math.abs(dd) < 0.004) v.targetYaw = null; }
        else if (!reduce && !v.routeOn) v.yaw += dt * (v.hover ? 0.12 : 0.34);
      }
      v.spin.rotation.y = v.yaw; v.pivot.rotation.x = v.pitch;
      if (v.type.startsWith('globe') && !reduce) v.pivot.rotation.z = Math.sin(now * 0.0004) * 0.03;
      draw(v);
      busy = busy || !reduce || v.dragging || Math.abs(v.vyaw) > 0.02 || v.targetYaw != null || !!(v.api && v.api.animating);
    }
    if (busy) raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) request(); });
  // page controls -> 3D: the route planner and the container builder talk to the viewers through these events
  const applyRoute = (d) => {
    window.__lastRoute = d;
    for (const v of viewers) {
      if (v.type !== 'globe') continue;
      const m = v.api.setRoute(d.from, d.to); v.routeOn = !!(d.from && d.to && d.from !== d.to);
      if (m) { v.targetYaw = Math.atan2(-m.x, m.z) - v.model.rotation.y; v.targetPitch = clamp(Math.asin(clamp(m.y, -1, 1)) * 0.8, -0.4, 0.45); v.vyaw = 0; }
      request();
    }
  };
  window.addEventListener('globe:route', (e) => applyRoute(e.detail));
  window.addEventListener('container:set', (e) => { window.__lastCfg = e.detail; for (const v of viewers) if (v.type === 'container-config') { v.api.set(e.detail); request(); } });
  if (window.__lastRoute) applyRoute(window.__lastRoute);
  if (window.__lastCfg) for (const v of viewers) if (v.type === 'container-config') v.api.set(window.__lastCfg);
  request();
  window.__viewers = { viewers, renderer };
}

if (els.length) init().catch((err) => console.warn('[viewers] disabled, using fallbacks:', err));
