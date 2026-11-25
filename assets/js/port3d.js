/* SS Gulf Shipping: real-time 3D container port (three.js, fully procedural, no model files).
   Story mode (home): scroll drives a camera flight through the port while the sky goes sunset -> night.
   Ambient mode (inner pages): slow orbit around ship / crane / yard.
   Falls back to the photo hero if WebGL, the CDN or the device cannot run it. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const root = document.documentElement;
const storyEl = document.querySelector('[data-story]');
const ambientEl = document.querySelector('[data-3d]');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function boot() {
  if (navigator.connection && navigator.connection.saveData) return;
  const reduce = root.classList.contains('reduce');
  const host = storyEl ? storyEl.querySelector('.scene') : ambientEl.querySelector('.phero__bg');
  if (!host) return;
  const small = matchMedia('(max-width: 860px)').matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const LOW = small || weak;

  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  if (storyEl) host.insertBefore(canvas, host.querySelector('.shade')); else host.appendChild(canvas);
  { const cin = document.createElement('div'); cin.className = 'cinema'; cin.setAttribute('aria-hidden', 'true'); canvas.after(cin); }

  let pixelRatio = Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if (!LOW) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  let composer = null, PP = null;
  if (!LOW) {
    try {
      PP = await Promise.all([import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'), import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/ShaderPass.js'), import('three/addons/postprocessing/OutputPass.js')]);
    } catch (e) { PP = null; }
  }

  // brand font for container decals (don't block long if the font CDN is slow)
  try { await Promise.race([document.fonts.load('800 110px "Exo 2"'), sleep(1200)]); } catch (e) { /* fall back to system font */ }

  /* ---------------- scene, sky, fog ---------------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xd9a07a, 0.0012);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3600);

  const skyU = {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() },
    sunCol: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0.95, 0.1, -0.3).normalize() }, uT: { value: 0 }
  };
  const SKY_FRAG = `uniform vec3 top,mid,hor,sunCol,sunDir; uniform float uT; varying vec3 vDir;
    float sh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float sn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(sh(i),sh(i+vec2(1.0,0.0)),f.x),mix(sh(i+vec2(0.0,1.0)),sh(i+vec2(1.0,1.0)),f.x),f.y);}
    float fbm(vec2 p){float a=0.5,v=0.0;for(int i=0;i<5;i++){v+=a*sn(p);p=p*2.03+vec2(17.0,9.0);a*=0.5;}return v;}
    void main(){ vec3 d=normalize(vDir); float h=d.y;
      vec3 col=mix(hor,mid,smoothstep(0.0,0.22,h)); col=mix(col,top,smoothstep(0.18,0.8,h));
      float sd=max(dot(d,normalize(sunDir)),0.0);
      col+=sunCol*(pow(sd,48.0)*0.8+pow(sd,5.0)*0.22+smoothstep(0.9994,0.9999,sd)*2.0);
      float hs=smoothstep(0.015,0.3,h);
      vec2 cp=d.xz/(h+0.2)*0.85+vec2(uT*0.006,uT*0.002);
      float cl=fbm(cp); float cov=smoothstep(0.5,0.8,cl)*hs; float thin=smoothstep(0.36,0.62,fbm(cp*1.7+5.0))*0.35*hs;
      float lit=pow(sd,2.0)*0.75+0.12;
      vec3 cc=mix(mid*0.5+top*0.2,sunCol*1.15+hor*0.55,clamp(lit+(1.0-cl)*0.35,0.0,1.0));
      col=mix(col,cc,clamp(cov*0.8+thin,0.0,0.9));
      col=mix(col,hor*0.55,1.0-smoothstep(-0.12,0.0,h));
      gl_FragColor=vec4(col,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: SKY_FRAG
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  /* ---------------- lights ---------------- */
  const hemi = new THREE.HemisphereLight(0x9db6e0, 0x4a3526, 0.9);
  const sun = new THREE.DirectionalLight(0xffb868, 3.4);
  const fill = new THREE.DirectionalLight(0x8aa8e8, 0.5); fill.position.set(0.2, 0.45, 1).multiplyScalar(300);
  scene.add(hemi, sun, fill, new THREE.AmbientLight(0xffffff, 0.1));
  sun.target.position.set(0, 0, 45); scene.add(sun.target);
  if (!LOW) {
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera; sc.left = -200; sc.right = 200; sc.top = 160; sc.bottom = -160; sc.near = 20; sc.far = 900;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.35; sun.shadow.radius = 3;
  }

  /* ---------------- shared materials / textures ---------------- */
  const NOISE_GLSL = 'float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}';
  function patchMat(mat, colorGLSL, roughGLSL) {
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wpp=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwpp=instanceMatrix*wpp;\n#endif\nvWp=(modelMatrix*wpp).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;\n' + NOISE_GLSL)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + colorGLSL)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + roughGLSL);
    };
    return mat;
  }
  const CONT_COLOR = 'float ly=mod(vWp.y+0.001,2.59); float st=vn(vec2(vWp.x*0.9+vWp.z*0.9,vWp.y*0.12)); float nb=vn(vWp.xz*0.5+vWp.y*0.3); float dirt=smoothstep(0.9,0.0,ly)*0.35+smoothstep(0.55,0.9,st)*0.22*smoothstep(2.59,1.0,ly); float rust=smoothstep(0.62,0.85,vn(vec2(vWp.x*2.3+vWp.z*2.3,vWp.y*0.5)))*smoothstep(0.7,0.0,ly); diffuseColor.rgb*=1.0-dirt*0.55; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.36,0.17,0.09),rust*0.5); diffuseColor.rgb*=0.9+0.2*nb;';
  const CONT_ROUGH = 'roughnessFactor=clamp(roughnessFactor+dirt*0.25+(nb-0.5)*0.2,0.3,1.0);';
  const contMat = patchMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.22 }), CONT_COLOR, CONT_ROUGH);
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x242e3a, roughness: 0.6, metalness: 0.5 });
  const craneOrange = new THREE.MeshStandardMaterial({ color: 0xe8691f, roughness: 0.55, metalness: 0.35 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.7, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1a30, roughness: 0.25, metalness: 0.6, emissive: 0xffc878, emissiveIntensity: 0 });
  const lampMats = [];       // MeshBasic materials whose colour fades up at night
  const glows = [];          // additive sprites { sprite, base }

  const glowTexture = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  function addGlow(x, y, z, color, size, base = 1) {
    const m = new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
    const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.set(size, size, 1);
    scene.add(s); glows.push({ m, base });
    return s;
  }

  function decalTexture(fg) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 124px "Exo 2","Arial Black",Impact,sans-serif';
    g.fillText('SS GULF SHIPPING', 512, 96);
    g.fillRect(70, 168, 884, 8);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  const decalOnOrange = new THREE.MeshStandardMaterial({ map: decalTexture('#0A1B33'), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const decalOnNavy = new THREE.MeshStandardMaterial({ map: decalTexture('#F37021'), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const decalGeo = new THREE.PlaneGeometry(9.2, 1.8);

  /* ---------------- ribbed shipping container (geometry shared by every box) ---------------- */
  const CL = 12.19, CH = 2.59, CW = 2.44;
  const contGeo = (() => {
    const parts = [];
    const add = (g, x, y, z, shade) => {
      g.deleteAttribute('uv'); g.translate(x, y, z);
      const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(shade);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g);
    };
    add(new THREE.BoxGeometry(CL, CH, CW - 0.1), 0, CH / 2, 0, 1);
    const ribs = LOW ? 8 : 12, pitch = (CL - 1.1) / ribs;
    for (let i = 0; i < ribs; i++) for (const s of [-1, 1])
      add(new THREE.BoxGeometry(pitch * 0.52, CH - 0.34, 0.12), -CL / 2 + 0.55 + pitch * (i + 0.5), CH / 2, s * (CW / 2), 0.93);
    for (const x of [-1, 1]) for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.2, CH, 0.2), x * (CL / 2 - 0.1), CH / 2, z * (CW / 2 - 0.1), 0.6);
    add(new THREE.BoxGeometry(CL, 0.16, CW), 0, CH - 0.08, 0, 0.72);
    add(new THREE.BoxGeometry(CL, 0.16, CW), 0, 0.08, 0, 0.6);
    for (const z of [-0.32, 0.32]) add(new THREE.BoxGeometry(0.1, CH - 0.45, 0.07), CL / 2 + 0.03, CH / 2, z, 0.5);
    return mergeGeometries(parts);
  })();

  const PALETTE = ['#a63d2f', '#a63d2f', '#1f4e8c', '#1f4e8c', '#2d6a6a', '#c9822b', '#7a8590', '#e7e4dc', '#3a6b3a', '#8b2f2f', '#e0a526', '#5a4a8c'];
  const BRAND = ['#F37021', '#0F2747'];
  function instanced(list) {
    const m = new THREE.InstancedMesh(contGeo, contMat, list.length);
    const mt = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach((it, i) => { mt.makeTranslation(it.x, it.y, it.z); m.setMatrixAt(i, mt); c.set(it.c); m.setColorAt(i, c); });
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    return m;
  }
  function addDecal(x, y, z, orange) {
    const p = new THREE.Mesh(decalGeo, orange ? decalOnOrange : decalOnNavy);
    p.position.set(x, y + CH / 2, z + CW / 2 + 0.07); scene.add(p);
  }

  /* ---------------- quay, water, far land ---------------- */
  const QUAY_W = LOW ? 2048 : 3072, QUAY_H = Math.round(QUAY_W * 0.6);
  const quayTex = (() => {
    const c = document.createElement('canvas'); c.width = QUAY_W; c.height = QUAY_H;
    const g = c.getContext('2d'); const r = rng(7);
    const X = (x) => (x + 200) / 400 * QUAY_W, Z = (z) => z / 240 * QUAY_H, px = QUAY_W / 400;
    g.fillStyle = '#2b323d'; g.fillRect(0, 0, QUAY_W, QUAY_H);
    for (let i = 0; i < 9000; i++) { const v = 36 + r() * 36; g.fillStyle = `rgb(${v},${v + 4},${v + 10})`; g.fillRect(r() * QUAY_W, r() * QUAY_H, 2 + r() * 5, 2 + r() * 5); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(10,12,18,${0.08 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * QUAY_W, r() * QUAY_H, 20 + r() * 90, 8 + r() * 40, r() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#e0a526'; g.fillRect(0, Z(0.4), QUAY_W, px * 0.5);                                // edge line
    g.fillStyle = '#6b7684'; for (const z of [1.5, 27]) g.fillRect(0, Z(z) - px * 0.4, QUAY_W, px * 0.8); // crane rails
    g.fillStyle = 'rgba(235,238,245,.85)'; g.fillRect(0, Z(31), QUAY_W, px * 0.25); g.fillRect(0, Z(41), QUAY_W, px * 0.25);
    for (let x = -200; x < 200; x += 9) g.fillRect(X(x), Z(36) - px * 0.15, px * 3, px * 0.3);      // lane dashes
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  })();
  const quayTop = new THREE.Mesh(new THREE.PlaneGeometry(400, 240), patchMat(new THREE.MeshStandardMaterial({ map: quayTex, roughness: 0.92, metalness: 0.05 }), 'float pud=smoothstep(0.52,0.66,vn(vWp.xz*0.045)*0.65+vn(vWp.xz*0.18)*0.35); diffuseColor.rgb*=1.0-0.38*pud;', 'roughnessFactor=mix(roughnessFactor,0.1,pud);'));
  quayTop.rotation.x = -Math.PI / 2; quayTop.position.set(0, 0.02, 120); scene.add(quayTop);
  const land = new THREE.Mesh(new THREE.BoxGeometry(2600, 8, 1500), new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: 1 }));
  land.position.set(0, -4, 750); scene.add(land);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2600, 5, 0.6), new THREE.MeshStandardMaterial({ color: 0x4a525e, roughness: 0.95 }));
  wall.position.set(0, -2.5, -0.2); scene.add(wall);

  const waterU = {
    uTime: { value: 0 }, uDeep: { value: new THREE.Color() }, uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0.0012 },
    top: skyU.top, mid: skyU.mid, hor: skyU.hor, sunCol: skyU.sunCol, sunDir: skyU.sunDir
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShaderMaterial({
    uniforms: waterU,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uTime,uFogDensity; uniform vec3 uDeep,uFogColor,top,mid,hor,sunCol,sunDir; varying vec3 vW;
      void main(){
        vec2 p=vW.xz*0.07; float t=uTime;
        float dx=cos(p.x*1.3+t*1.1)*.16+cos(p.x*2.7+p.y*1.1-t*1.7)*.22+cos(p.x*5.3+p.y*3.1+t*2.3)*.12+cos(p.x*11.0-p.y*7.0+t*3.1)*.05;
        float dz=cos(p.y*1.1+t*.9)*.14+cos(p.y*2.9-p.x*1.7+t*1.4)*.2+cos(p.y*5.9+p.x*2.3-t*2.1)*.1+cos(p.y*13.0+p.x*5.0-t*2.7)*.05;
        vec3 n=normalize(vec3(-dx*.36,1.0,-dz*.36));
        vec3 V=normalize(cameraPosition-vW); vec3 R=reflect(-V,n);
        float fres=clamp(pow(1.0-max(dot(n,V),0.0),2.6)*0.9+0.16,0.0,1.0);
        float h=max(R.y,0.0); vec3 sk=mix(hor,mid,smoothstep(0.0,0.22,h)); sk=mix(sk,top,smoothstep(0.18,0.8,h));
        float sd=max(dot(R,normalize(sunDir)),0.0);
        vec3 spec=sunCol*(pow(sd,260.0)*3.0+pow(sd,24.0)*0.28);
        vec3 col=mix(uDeep,sk,fres)+spec;
        float d=length(cameraPosition-vW); float f=1.0-exp(-uFogDensity*uFogDensity*d*d);
        col=mix(col,uFogColor,clamp(f,0.0,1.0));
        gl_FragColor=vec4(col,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  water.rotation.x = -Math.PI / 2; water.position.y = -3; scene.add(water);

  const hillMat = new THREE.MeshBasicMaterial({ color: 0x4a3a4a, fog: false });
  const hillR = rng(3);
  for (let i = 0; i < 14; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), hillMat);
    const side = i % 2 ? 1 : -1, z = side > 0 ? 1350 + hillR() * 220 : -1750 - hillR() * 150;
    h.scale.set(260 + hillR() * 260, 60 + hillR() * 120, 180 + hillR() * 120);
    h.position.set(-1500 + (i / 13) * 3000 + hillR() * 120, 0, z); scene.add(h);
  }
  const cityGeo = new THREE.BufferGeometry(); const cp = []; const cr = rng(11);
  for (let i = 0; i < 700; i++) cp.push(-1000 + cr() * 2000, 1 + cr() * cr() * 60, 880 + cr() * 420);
  cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  const cityMat = new THREE.PointsMaterial({ size: 3.2, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(cityGeo, cityMat));

  /* ---------------- container yard ---------------- */
  {
    const r = rng(21), list = [];
    const bays = LOW ? 13 : 21, rows = LOW ? 12 : 22, x0 = -(bays - 1) * 12.6 / 2;
    for (let b = 0; b < bays; b++) for (let row = 0; row < rows; row++) {
      if (r() < 0.12) continue;
      const z = 48 + row * 2.7 + Math.floor(row / 6) * 9, h = 1 + Math.floor(r() * (r() < 0.3 ? 5 : 4));
      for (let k = 0; k < h; k++) list.push({ x: x0 + b * 12.6, y: k * CH, z, c: r() < 0.09 ? BRAND[Math.floor(r() * 2)] : PALETTE[Math.floor(r() * PALETTE.length)] });
    }
    scene.add(instanced(list));
  }

  /* ---------------- container ship ---------------- */
  const ship = new THREE.Group(); scene.add(ship);
  {
    const halfBeam = (x) => (x < -100 ? 15 + 4 * Math.sqrt(Math.max(0, 1 - Math.pow((-100 - x) / 15, 2))) : x < 60 ? 19 : 19 * Math.pow(Math.max(0, 1 - (x - 60) / 75), 0.65));
    const xs = []; for (let x = -115; x <= 135.01; x += 5) xs.push(x);
    const shape = new THREE.Shape();
    xs.forEach((x, i) => (i ? shape.lineTo(x, 24 + halfBeam(x)) : shape.moveTo(x, 24 + halfBeam(x))));
    for (let i = xs.length - 1; i >= 0; i--) shape.lineTo(xs[i], 24 - halfBeam(xs[i]));
    const mk = (depth, y, mats) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mats); m.position.y = y; ship.add(m); return m; };
    const hullRed = new THREE.MeshStandardMaterial({ color: 0x8a2a22, roughness: 0.7, metalness: 0.15 });
    const hullNavy = new THREE.MeshStandardMaterial({ color: 0x2b4f86, roughness: 0.55, metalness: 0.12 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.85, metalness: 0.2 });
    mk(9, -12, [hullRed, hullRed]);
    mk(12, -3, [deckMat, hullNavy]);   // hull top = deck level (y 9), where the cargo starts
    // waterline foam
    const foam = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2; foam.scale.set(1.012, 1.045, 1); foam.position.set(-0.12, -2.92, 1.08); ship.add(foam);

    // superstructure + funnel + masts
    const box = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); ship.add(m); return m; };
    for (let i = 0; i < 5; i++) box(22 - i * 1.5, 4.4, 34 - i * 1.2, -92 + i * 0.4, 11.2 + i * 4.4, -24, whiteMat);
    box(7, 3, 38, -88.5, 34.5, -24, whiteMat);
    for (let i = 0; i < 5; i++) box(0.3, 1.1, 30 - i, -81.2 + i * 0.4 - 0.3, 11.4 + i * 4.4, -24, glass);
    box(0.3, 1.3, 36, -85.2, 34.6, -24, glass);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 12, 20), craneOrange); funnel.position.set(-96, 41, -24); ship.add(funnel);
    box(7.4, 1.6, 7.4, -96, 47.5, -24, steelDark);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 16, 8), steelDark); mast.position.set(-88.5, 44, -24); ship.add(mast);
    box(1, 1, 1, 128, 14, -24, steelDark).scale.set(0.8, 6, 0.8);
    const deckLamps = [[-88.5, 52.5, -24], [127, 21, -24]];
    deckLamps.forEach(([x, y, z]) => { const s = addGlow(x, y, z, 0xff4b3a, 9, 1); ship.attach(s); });

    // deck cargo
    const r = rng(33), list = [], branded = [];
    const bays = LOW ? 9 : 14, rows = 12;
    for (let b = 0; b < bays; b++) {
      const x = -60 + b * 13.2, taper = b > bays - 3 ? 2 : 0;
      for (let row = 0; row < rows; row++) {
        const z = -24 + (row - 5.5) * 2.7;
        const isBrand = b >= 5 && b <= 8 && row >= 8;
        const h = Math.max(1, (isBrand ? 4 : 3 + Math.floor(r() * 3)) - taper);
        for (let k = 0; k < h; k++) {
          const c = isBrand ? BRAND[k % 2] : (r() < 0.08 ? BRAND[Math.floor(r() * 2)] : PALETTE[Math.floor(r() * PALETTE.length)]);
          list.push({ x, y: 9 + k * CH, z, c });
          if (isBrand && row === 11) branded.push({ x, y: 9 + k * CH, z, orange: k % 2 === 0 });
        }
      }
    }
    const cargo = instanced(list); ship.add(cargo);
    branded.forEach((b) => {
      const p = new THREE.Mesh(decalGeo, b.orange ? decalOnOrange : decalOnNavy);
      p.position.set(b.x, b.y + CH / 2, b.z + CW / 2 + 0.07); ship.add(p);
    });
  }

  /* ---------------- quay cranes ---------------- */
  function beamGeo(a, b, t) {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    const g = new THREE.BoxGeometry(t, len, t); g.deleteAttribute('uv');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    return g;
  }
  const hangMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xF37021, roughness: 0.6, metalness: 0.3 });
  const cranes = [];
  function makeCrane(cx, phase) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z), o = [], d = [];
    const H = 41, zW = -1.5, zL = 27, hw = 8, zT = -62, zB = 45;
    for (const sx of [-hw, hw]) {
      o.push(beamGeo(V(sx, 0, zW), V(sx, H, zW), 1.7), beamGeo(V(sx, 0, zL), V(sx, H, zL), 1.7));
      d.push(beamGeo(V(sx, 0.8, zW), V(sx, 0.8, zL), 1.3));
      o.push(beamGeo(V(sx, H, zW), V(sx, H, zL), 2.0), beamGeo(V(sx, 0, zW), V(sx, 26, zL), 0.7), beamGeo(V(sx, 0, zL), V(sx, 26, zW), 0.7), beamGeo(V(sx, 20, zW), V(sx, 20, zL), 0.8));
    }
    for (const z of [zW, zL]) { o.push(beamGeo(V(-hw, H, z), V(hw, H, z), 2.0), beamGeo(V(-hw, 20, z), V(hw, 20, z), 0.8)); for (const sx of [-3.4, 3.4]) o.push(beamGeo(V(sx, H, z), V(sx, 45, z), 0.9)); }
    for (const sx of [-3.4, 3.4]) {
      o.push(beamGeo(V(sx, 45, zT), V(sx, 45, zB), 1.1), beamGeo(V(sx, 50, zT), V(sx, 50, zB), 1.1));
      for (let z = zT; z < zB; z += 5) o.push(beamGeo(V(sx, 45, z), V(sx, 50, z), 0.45), beamGeo(V(sx, 45, z), V(sx, 50, z + 5), 0.4));
    }
    for (let z = zT; z <= zB; z += 10) o.push(beamGeo(V(-3.4, 50, z), V(3.4, 50, z), 0.5));
    const house = new THREE.BoxGeometry(11, 6, 9); house.deleteAttribute('uv'); house.translate(0, 53, 34); d.push(house);

    const g = new THREE.Group(); g.position.x = cx;
    g.add(new THREE.Mesh(mergeGeometries(o), craneOrange), new THREE.Mesh(mergeGeometries(d), steelDark));
    scene.add(g);

    const trolley = new THREE.Mesh(new THREE.BoxGeometry(7, 2, 3.4), steelDark); g.add(trolley);
    const spreader = new THREE.Group(); g.add(spreader);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.4, 2.5), steelDark); sp.position.y = -0.2; spreader.add(sp);
    const hang = new THREE.Mesh(contGeo, hangMat); hang.position.y = -0.4 - CH; spreader.add(hang);
    for (const s of [-1, 1]) { const dm = new THREE.Mesh(decalGeo, decalOnOrange); dm.position.set(0, -0.4 - CH / 2, s * (CW / 2 + 0.07)); if (s < 0) dm.rotation.y = Math.PI; spreader.add(dm); }
    const cables = [];
    for (const [cxo, czo] of [[-5, -1], [-5, 1], [5, -1], [5, 1]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 5), steelDark); g.add(c); cables.push({ c, cxo, czo }); }

    // static flatbed under the quay-side drop point
    const bed = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.3, 2.5), steelDark); bed.position.set(0, 1.0, 14); g.add(bed);
    for (const x of [-4.8, -3.6, -2.4]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), steelDark); w.rotation.x = Math.PI / 2; w.position.set(x, 0.5, s * 1.1); g.add(w); }

    const tip = addGlow(cx, 51.5, zT, 0xff3b30, 11, 1); const tip2 = addGlow(cx, 56.5, 34, 0xff3b30, 9, 1);
    cranes.push({ g, trolley, spreader, cables, phase, tip, tip2 });
  }
  makeCrane(-30, 0); makeCrane(100, 9);
  const CYCLE = [[0, -24, 22], [3, -24, 34], [8, 14, 34], [11, 14, 4], [14, 14, 4], [17, 14, 34], [22, -24, 34], [24, -24, 22]];
  function animateCranes(t) {
    for (const c of cranes) {
      const tt = (t + c.phase) % 24; let i = 0; while (i < CYCLE.length - 2 && tt > CYCLE[i + 1][0]) i++;
      const a = CYCLE[i], b = CYCLE[i + 1], k = smooth(0, 1, (tt - a[0]) / (b[0] - a[0]));
      const z = lerp(a[1], b[1], k), y = lerp(a[2], b[2], k);
      c.trolley.position.set(0, 44, z); c.spreader.position.set(0, y, z);
      for (const cb of c.cables) { const len = 43 - y; cb.c.scale.y = Math.max(0.1, len); cb.c.position.set(cb.cxo, y + len / 2, z + cb.czo); }
    }
  }

  /* ---------------- truck (driven by scroll in story mode) ---------------- */
  const truck = new THREE.Group(); scene.add(truck);
  const truckWheels = [], headMats = [];
  {
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); truck.add(m); return m; };
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.45, metalness: 0.3 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.9 });
    add(new THREE.BoxGeometry(6.4, 0.5, 2.2), steelDark, 0.3, 0.85, 0);
    add(new THREE.BoxGeometry(2.7, 2.7, 2.5), cabMat, 2.2, 2.45, 0);
    add(new THREE.BoxGeometry(0.1, 1.2, 2.25), glass, 3.52, 2.95, 0);
    add(new THREE.BoxGeometry(0.2, 0.5, 2.55), new THREE.MeshStandardMaterial({ color: 0xF37021, roughness: 0.5 }), 3.5, 1.35, 0);
    for (const s of [-0.85, 0.85]) { const hm = new THREE.MeshBasicMaterial({ color: 0x20180f }); headMats.push(hm); add(new THREE.BoxGeometry(0.1, 0.3, 0.45), hm, 3.56, 1.35, s); }
    add(new THREE.BoxGeometry(12.6, 0.28, 2.5), steelDark, -7.6, 1.2, 0);
    const wGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.38, 14); wGeo.rotateX(Math.PI / 2);
    for (const x of [2.5, 0.2, -1.1, -10.2, -11.5, -12.8]) for (const s of [-1, 1]) truckWheels.push(add(wGeo, rubber, x, 0.55, s * 1.05));
    const box = new THREE.Mesh(contGeo, new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x0F2747, roughness: 0.6, metalness: 0.3 }));
    box.position.set(-7.6, 1.34, 0); truck.add(box);
    for (const s of [-1, 1]) { const dm = new THREE.Mesh(decalGeo, decalOnNavy); dm.position.set(-7.6, 1.34 + CH / 2, s * (CW / 2 + 0.07)); if (s < 0) dm.rotation.y = Math.PI; truck.add(dm); }
    truck.rotation.y = Math.PI; // faces -x
    truck.position.set(95, 0, 39.5);
  }
  const truckX = (f) => 90 - clamp((f - 2.2) / 1.6) * 180;

  /* ---------------- quay lamps ---------------- */
  {
    const poles = [], heads = [];
    for (let x = -150; x <= 150; x += 30) {
      const p = new THREE.CylinderGeometry(0.22, 0.32, 26, 8); p.translate(x, 13, 44); poles.push(p);
      const hd = new THREE.BoxGeometry(3.4, 0.5, 1.2); hd.translate(x, 26.2, 44); heads.push(hd);
      addGlow(x, 25.6, 44, 0xffc878, 26, 1);
    }
    scene.add(new THREE.Mesh(mergeGeometries(poles.map((g) => (g.deleteAttribute('uv'), g))), steelDark));
    const lm = new THREE.MeshBasicMaterial({ color: 0x20180f }); lampMats.push(lm);
    scene.add(new THREE.Mesh(mergeGeometries(heads.map((g) => (g.deleteAttribute('uv'), g))), lm));
  }

  if (!LOW) {
    scene.traverse((o) => {
      if (!o.isMesh || o === sky || !o.material || o.material.isShaderMaterial) return;
      o.receiveShadow = true;
      if (o.material.transparent || o.geometry.type === 'PlaneGeometry' || o.geometry.type === 'SphereGeometry') return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox; if (!o.isInstancedMesh && Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) > 500) return;
      o.castShadow = true;
    });
  }

  /* ---------------- environment map from the dusk sky (once) ---------------- */
  {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), skyMat.clone());
    envSky.material.uniforms = {
      top: { value: new THREE.Color('#1d3a70') }, mid: { value: new THREE.Color('#9a6a78') }, hor: { value: new THREE.Color('#ffb070') },
      sunCol: { value: new THREE.Color('#ffb868') }, sunDir: { value: new THREE.Vector3(0.95, 0.1, -0.3).normalize() }
    };
    envScene.add(envSky);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.04).texture;
    pm.dispose();
  }

  /* ---------------- time of day (0 = sunset, 0.5 = dusk, 1 = night) ---------------- */
  const KEYS = [
    { top: '#27508f', mid: '#d68a63', hor: '#ffc27a', sun: '#ffb868', sunY: 0.08, sunI: 3.4, hemiS: '#9db6e0', hemiG: '#4a3526', hemiI: 0.9, fill: '#8aa8e8', fillI: 0.55, fog: '#d9a07a', fogD: 0.0012, exp: 1.0, env: 0.8, lamp: 0.1, deep: '#1a4a78', hill: '#5a4252' },
    { top: '#12285a', mid: '#6a4a73', hor: '#f0885a', sun: '#f09a60', sunY: 0.0, sunI: 1.5, hemiS: '#5b78b5', hemiG: '#2a2030', hemiI: 0.8, fill: '#7a96d8', fillI: 0.5, fog: '#7d5a78', fogD: 0.0015, exp: 1.08, env: 0.55, lamp: 0.65, deep: '#0e2e52', hill: '#2a2438' },
    { top: '#030a1c', mid: '#0e2046', hor: '#24427a', sun: '#4a6ab8', sunY: -0.12, sunI: 0.5, hemiS: '#22356a', hemiG: '#0a0e18', hemiI: 0.7, fill: '#5a7ac4', fillI: 0.42, fog: '#0d1c3a', fogD: 0.0019, exp: 1.2, env: 0.4, lamp: 1.0, deep: '#030d1c', hill: '#070b14' }
  ];
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  function mix3(out, key, n) {
    const a = n < 0.5 ? KEYS[0] : KEYS[1], b = n < 0.5 ? KEYS[1] : KEYS[2], k = n < 0.5 ? n * 2 : (n - 0.5) * 2;
    tmpA.set(a[key]); tmpB.set(b[key]); return out.copy(tmpA).lerp(tmpB, k);
  }
  const num3 = (key, n) => (n < 0.5 ? lerp(KEYS[0][key], KEYS[1][key], n * 2) : lerp(KEYS[1][key], KEYS[2][key], (n - 0.5) * 2));
  const sunVec = new THREE.Vector3();
  function applyTime(n) {
    mix3(skyU.top.value, 'top', n); mix3(skyU.mid.value, 'mid', n); mix3(skyU.hor.value, 'hor', n); mix3(skyU.sunCol.value, 'sun', n);
    const sy = num3('sunY', n); skyU.sunDir.value.set(0.95, sy, -0.3).normalize();
    sunVec.set(0.95, Math.max(sy, 0.35), -0.3).normalize(); sun.position.copy(sunVec).multiplyScalar(400).add(sun.target.position);
    sun.color.copy(skyU.sunCol.value); sun.intensity = num3('sunI', n);
    mix3(hemi.color, 'hemiS', n); mix3(hemi.groundColor, 'hemiG', n); hemi.intensity = num3('hemiI', n);
    mix3(fill.color, 'fill', n); fill.intensity = num3('fillI', n);
    mix3(scene.fog.color, 'fog', n); scene.fog.density = num3('fogD', n);
    waterU.uFogColor.value.copy(scene.fog.color); waterU.uFogDensity.value = scene.fog.density; mix3(waterU.uDeep.value, 'deep', n);
    mix3(hillMat.color, 'hill', n);
    renderer.toneMappingExposure = num3('exp', n); scene.environmentIntensity = num3('env', n);
    const L = num3('lamp', n);
    glass.emissiveIntensity = L * 1.6;
    lampMats.forEach((m) => m.color.setRGB(lerp(0.12, 1.0, L), lerp(0.1, 0.82, L), lerp(0.06, 0.5, L)));
    headMats.forEach((m) => m.color.setRGB(lerp(0.15, 1, L), lerp(0.12, 0.95, L), lerp(0.08, 0.75, L)));
    glows.forEach((g) => { g.m.opacity = clamp(L * g.base * 0.9); });
    cityMat.opacity = clamp((L - 0.3) * 1.4);
  }

  /* ---------------- camera rig ---------------- */
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const chase = (f) => { const x = truckX(f); return [V3(x + 26, 4.8, 32.5), V3(x - 6, 3.2, 39.5)]; };
  const KP = [V3(-130, 54, -158), V3(-96, 40, -112), V3(-8, 20, -68), V3(28, 52, -62), V3(14, 8, 16), chase(2.5)[0], chase(3)[0], chase(3.5)[0], V3(-22, 22, 38)];
  const KL = [V3(20, 8, -24), V3(0, 15, -22), V3(-30, 21, -22), V3(10, 12, -24), V3(28, 15, -12), chase(2.5)[1], chase(3)[1], chase(3.5)[1], V3(20, 7, 100)];
  const posCurve = new THREE.CatmullRomCurve3(KP, false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(KL, false, 'centripetal');
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), pt = new THREE.Vector3();
  const eased = (f) => clamp(f - (0.55 * Math.sin(2 * Math.PI * f)) / (2 * Math.PI), 0, 4);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  const VIEWS = { ship: { t: V3(10, 14, -24), r: 128, h: 30, base: Math.PI, sway: 0.55, speed: 0.06 }, crane: { t: V3(-30, 24, -22), r: 78, h: 16, base: Math.PI * 0.82, sway: 0.5, speed: 0.07 }, yard: { t: V3(20, 6, 96), r: 88, h: 24, base: Math.PI, sway: 0.5, speed: 0.055 } };
  const view = ambientEl ? (VIEWS[ambientEl.dataset['3d']] || VIEWS.ship) : null;
  const ambientTod = ambientEl ? parseFloat(ambientEl.dataset.tod || '0.5') : 0;

  const state = { f: window.__storyF || 0, t: 0 };
  addEventListener('story:progress', (e) => { state.f = e.detail.f; });

  function setCamera(time) {
    if (storyEl) {
      const g = eased(state.f), u = g / 4;
      posCurve.getPoint(u, camPos); lookCurve.getPoint(u, camLook);
    } else {
      const a = view.base + Math.sin(time * view.speed) * view.sway;
      camPos.set(view.t.x + Math.sin(a) * view.r, view.t.y + view.h + Math.sin(time * 0.11) * 2, view.t.z + Math.cos(a) * view.r);
      camLook.copy(view.t);
    }
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;
    camera.position.copy(camPos); camera.lookAt(camLook);
    camera.translateX(mouse.x * 3.2); camera.translateY(-mouse.y * 1.6);
    if (!reduce) { camera.translateX(Math.sin(time * 1.3) * 0.05 + Math.sin(time * 3.1) * 0.015); camera.translateY(Math.sin(time * 1.7 + 1) * 0.04); camera.rotateZ(Math.sin(time * 0.9) * 0.0012); }
    if (camera.position.y < 2.5) camera.position.y = 2.5;
  }

  function update(dt) {
    state.t += dt;
    const n = storyEl ? smooth(0.04, 0.96, state.f / 4) : ambientTod;
    applyTime(n);
    waterU.uTime.value = state.t;
    ship.position.y = Math.sin(state.t * 0.5) * 0.12; ship.rotation.z = Math.sin(state.t * 0.37) * 0.0025; ship.rotation.x = Math.sin(state.t * 0.43) * 0.0018;
    animateCranes(state.t);
    if (storyEl) {
      const tx = truckX(state.f); const dx = tx - truck.position.x; truck.position.x = tx;
      truckWheels.forEach((w) => { w.rotation.z -= dx / 0.55; });
      truck.visible = state.f > 1.7 && state.f < 4.2;
    } else truck.visible = false;
    const blink = 0.55 + 0.45 * Math.sin(state.t * 3.2);
    glows.forEach((g) => { /* slow breathing on every light */ g.m.opacity *= 0.88 + 0.12 * blink; });
    sky.position.copy(camera.position); skyU.uT.value = state.t;
    setCamera(state.t);
  }

  /* ---------------- sizing, loop, visibility, fallbacks ---------------- */
  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(pixelRatio); composer.setSize(w, h); }
    camera.aspect = w / h; camera.fov = w / h < 1 ? 64 : 42; camera.updateProjectionMatrix();
  }
  if (PP) {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }] = PP;
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.6, 0.92));
      composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec2 c=vUv-0.5; vec2 o=c*dot(c,c)*0.014; gl_FragColor=vec4(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b,1.0); }' }));
      composer.addPass(new OutputPass());
    } catch (e) { composer = null; }
  }
  resize(); new ResizeObserver(() => { resize(); if (reduce) draw(); }).observe(host);

  let raf = 0, visible = true, last = performance.now(), frames = 0, acc = 0, ready = false, dead = false;
  function paint() { if (composer) { try { composer.render(); return; } catch (e) { composer = null; } } renderer.render(scene, camera); }
  function draw() { update(0); paint(); }
  function reveal() { if (ready) return; ready = true; host.classList.add('is-3d'); }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); paint();
    if (!ready && ++frames > 2) reveal();
    if (frames > 8 && frames <= 100) { acc += dt; if (frames === 100) { const avg = acc / 92; if (avg > 0.034 && renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); } if (avg > 0.05 && composer) composer = null; if (avg > 0.026 && pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(1); resize(); } else if (avg > 0.034 && pixelRatio > 0.75) { pixelRatio = 0.75; renderer.setPixelRatio(0.75); resize(); } } }
  }
  const start = () => { if (!raf && !dead && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0 }).observe(storyEl || host);
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : (visible && start()); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dead = true; stop(); host.classList.remove('is-3d'); canvas.remove(); });

  renderer.compile(scene, camera);
  if (reduce) { draw(); reveal(); } else start();
  window.__port3d = { renderer, scene, camera, state, draw, pathAt: (f) => { posCurve.getPoint(eased(f) / 4, pt); return pt.clone(); }, lookAt: (f) => { lookCurve.getPoint(eased(f) / 4, pt); return pt.clone(); } };
}

// start last, so every module-level helper above is initialised
if (storyEl || ambientEl) boot().catch((err) => console.warn('[3D] disabled, using photos:', err));
