// Builds the 3D world for a compiled hole.
import * as THREE from 'three';
import { S, TIMES, OBJ, WATER_COLORS } from '../core/data.js';
import { paintHole, mix, noiseCanvas } from '../core/painter.js';
import { clamp, mulberry32, fbm, DEG, hashStr, pointInPoly, smoothstep } from '../core/util.js';
import { speciesGeometry, SPECIES_INFO, tuftGeometry, buildGolfer, hasSpecies, foliageTexture } from './models.js';
import { engine } from './engine.js';
import { getSettings } from '../core/store.js';

export const to3 = (x, y, h) => new THREE.Vector3(x, h, -y);

const shared = { time: { value: 0 }, wind: { value: new THREE.Vector2(0.3, 0) }, sunView: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 1, 1) } };

// Foliage: leaf-atlas texture with alpha-to-coverage edges, wind sway and light glowing through leaves
function swayMaterial(opts) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: opts.rough ?? 0.78, metalness: 0, side: opts.side || THREE.DoubleSide,
    map: foliageTexture(engine.renderer), alphaTest: 0.42, alphaToCoverage: true,
  });
  const sway = { value: opts.amp }, base = { value: opts.base };
  const trans = { value: opts.trans ?? 0.45 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time; sh.uniforms.uWind = shared.wind; sh.uniforms.uSway = sway; sh.uniforms.uSwayBase = base;
    sh.uniforms.uSunView = shared.sunView; sh.uniforms.uSunCol = shared.sunCol; sh.uniforms.uTrans = trans;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunView; uniform vec3 uSunCol; uniform float uTrans;')
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        // foliage cards are lit by their canopy-shaped normals on both sides (no back-face flip)
        normal = normalize(vNormal);`)
      .replace('#include <alphatest_fragment>', `
        #ifdef USE_MAP
          // keep distant foliage dense: boost alpha as the texture minifies
          vec2 tsz = vMapUv * 1024.0;
          vec2 tdx = dFdx(tsz), tdy = dFdy(tsz);
          float tlod = max(0.0, 0.5 * log2(max(dot(tdx, tdx), dot(tdy, tdy))));
          diffuseColor.a *= 1.0 + tlod * 0.3;
        #endif
        #include <alphatest_fragment>`)
      .replace('#include <opaque_fragment>', `
        // translucency: sunlight scattering through leaves when looking toward the sun
        float bl = pow(max(dot(normalize(vViewPosition), -uSunView), 0.0), 4.0);
        outgoingLight += diffuseColor.rgb * uSunCol * bl * uTrans;
        #include <opaque_fragment>`);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec2 uWind; uniform float uSway; uniform float uSwayBase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float swh = max(position.y - uSwayBase, 0.0);
      float ph = uTime * 1.7 + ip.x * 0.37 + ip.z * 0.23;
      float gu = sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.3;
      float wl = length(uWind);
      transformed.x += (uWind.x * (0.5 + gu * 0.5) + gu * 0.25 * (0.3 + wl)) * swh * uSway;
      transformed.z += (uWind.y * (0.5 + gu * 0.5) + gu * 0.18 * (0.3 + wl)) * swh * uSway;`);
  };
  m.customProgramCacheKey = () => 'foliage';
  return m;
}
let foliageDepth = null;
function foliageDepthMaterial() {
  if (!foliageDepth) foliageDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: foliageTexture(engine.renderer), alphaTest: 0.5 });
  return foliageDepth;
}

function waterNormalTexture() {
  const N = 256, h = new Float32Array(N * N);
  const rnd = mulberry32(42);
  // organic ripples: tileable noise at two scales plus a few soft crossing swells
  const n1 = noiseCanvas(N, 4, 11, 1).getContext('2d').getImageData(0, 0, N, N).data;
  const n2 = noiseCanvas(N, 10, 23, 1).getContext('2d').getImageData(0, 0, N, N).data;
  const waves = [];
  for (let k = 0; k < 6; k++) waves.push([Math.floor(rnd() * 7) - 3 || 2, Math.floor(rnd() * 7) - 3, rnd() * 6.28, 0.18 / (1 + k * 0.4)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x;
    let v = (n1[k * 4] / 255 - 0.5) * 1.6 + (n2[k * 4] / 255 - 0.5) * 0.7;
    for (const [kx, ky, ph, a] of waves) v += Math.sin((kx * x + ky * y) / N * Math.PI * 2 + ph) * a;
    h[k] = v;
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)];
    const dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
    const l = Math.hypot(dx, dy, 1.2);
    const k = (y * N + x) * 4;
    data[k] = (-dx / l * 0.5 + 0.5) * 255; data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; data[k + 2] = (1.2 / l * 0.5 + 0.5) * 255; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
let waterNormals = null;

function waterMaterial(env, shallow, deep, opacity = 0.9, scale = 0.08, depthAware = false) {
  if (!waterNormals) waterNormals = waterNormalTexture();
  return new THREE.ShaderMaterial({
    transparent: true, fog: true, depthWrite: true,
    defines: depthAware ? { USE_DEPTH: '' } : {},
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: shared.time, uNormal: { value: waterNormals }, uSun: { value: env.sunDir }, uSunCol: { value: env.sunCol },
      uSkyH: { value: env.horizon }, uSkyT: { value: env.top }, uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) },
      uOpacity: { value: opacity }, uScale: { value: scale },
    }]),
    vertexShader: `
      varying vec3 vW;
      #ifdef USE_DEPTH
        attribute float aDepth; attribute float aIn; varying float vDepth; varying float vIn;
      #endif
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #ifdef USE_DEPTH
        vDepth = aDepth; vIn = aIn;
      #endif
      #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uNormal; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSkyH; uniform vec3 uSkyT;
      uniform vec3 uShallow; uniform vec3 uDeep; uniform float uOpacity; uniform float uScale;
      varying vec3 vW;
      #ifdef USE_DEPTH
        varying float vDepth; varying float vIn;
      #endif
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        #ifdef USE_DEPTH
          if (vIn < 0.5) discard;
        #endif
        vec2 uv = vW.xz * uScale;
        vec3 n1 = texture2D(uNormal, uv + vec2(uTime*0.021, uTime*0.013)).xyz*2.0-1.0;
        vec3 n2 = texture2D(uNormal, uv*1.73 + vec2(-uTime*0.017, uTime*0.011)).xyz*2.0-1.0;
        vec3 n3 = texture2D(uNormal, uv*0.31 + vec2(uTime*0.006, -uTime*0.004)).xyz*2.0-1.0;
        vec3 n = normalize(vec3(n1.x+n2.x+n3.x*0.6, 3.2, n1.y+n2.y+n3.y*0.6));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.03 + 0.97*pow(1.0 - max(dot(n,V),0.0), 4.0);
        vec3 R = reflect(-V, n);
        vec3 sky = mix(uSkyH, uSkyT, pow(max(R.y,0.0),0.6));
        vec3 base = mix(uDeep, uShallow, 0.35 + 0.25*n.x);
        vec3 col = mix(base, sky, clamp(fres*1.1, 0.0, 0.95));
        float sp = pow(max(dot(R, uSun), 0.0), 260.0) * 4.0 + pow(max(dot(R, uSun), 0.0), 30.0) * 0.15;
        col += uSunCol * sp;
        float alpha = uOpacity;
        #ifdef USE_DEPTH
          // shallow water is clear and tinted, deep water dark; foam laps the shoreline
          float dep = max(vDepth, 0.0);
          float s = smoothstep(0.0, 1.6, dep);
          vec3 tint = mix(uShallow * 1.25 + vec3(0.05, 0.05, 0.0), uDeep, s);
          col = mix(tint, sky, clamp(fres * 1.1, 0.0, 0.95)) + uSunCol * sp;
          alpha = mix(0.32, uOpacity, smoothstep(0.0, 0.9, dep)) + fres * 0.3;
          float foam = smoothstep(0.16, 0.0, dep + n1.x * 0.05) * (0.55 + 0.45 * sin(uTime * 1.7 + vW.x * 0.9 + vW.z * 0.7));
          col = mix(col, vec3(0.93, 0.95, 0.95), foam * 0.75);
          alpha = max(alpha, foam * 0.85);
        #endif
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

function skyMaterial(env, clouds) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: env.top }, uHor: { value: env.horizon }, uGround: { value: env.groundHaze }, uSun: { value: env.sunDir }, uSunCol: { value: env.sunCol }, uTime: shared.time, uClouds: { value: clouds }, uWind: shared.wind },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uGround; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uTime; uniform float uClouds; uniform vec2 uWind;
      varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=n(p)*a; p*=2.07; a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        vec3 col = mix(uHor, uTop, pow(clamp(y,0.0,1.0), 0.42));
        col = mix(col, uGround, smoothstep(0.0, -0.25, y));
        // forward scattering: the horizon glows warmer on the sun's side; zenith deepens
        float hz = pow(1.0 - abs(y), 5.0);
        float toward = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(uSun.x, 0.0, uSun.z) + 1e-5)), 0.0);
        col += uSunCol * hz * toward * toward * 0.22 * (1.2 - uSun.y);
        col *= mix(1.0, 0.86, smoothstep(0.45, 1.0, y));
        float sd = max(dot(d, uSun), 0.0);
        col += uSunCol * (pow(sd, 1200.0) * 8.0 + pow(sd, 14.0) * 0.28 + pow(sd, 3.0) * 0.06);
        if (y > 0.0) {
          vec2 uv = d.xz / (y + 0.15) * 0.55 + uWind * uTime * 0.0015;
          float c = fbm(uv * 1.3);
          float cov = smoothstep(1.0 - uClouds * 0.85, 1.12 - uClouds * 0.55, c + 0.12) * smoothstep(0.0, 0.18, y);
          float sh = fbm(uv * 1.3 + vec2(0.06, 0.04));
          float lit = clamp((c - sh) * 6.0 + 0.5, 0.0, 1.0);
          vec3 cc = mix(vec3(1.0), uSunCol, 0.25) * (0.72 + 0.38 * lit);
          cc = mix(cc, uHor * 0.85, 0.25 * (1.0 - lit));
          cc += uSunCol * pow(sd, 7.0) * (1.25 - cov) * 0.9; // silver lining near the sun
          float wisp = smoothstep(0.55, 0.9, fbm(uv * 4.0 + 7.3)) * 0.25 * smoothstep(0.1, 0.4, y);
          col = mix(col, cc, cov * 0.92);
          col = mix(col, vec3(1.0), wisp * (1.0 - cov));
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Camera-facing ribbon used for the shot tracer, aim arc and putt line
export class Ribbon {
  constructor(max, color, opts = {}) {
    this.max = max; this.n = 0; this.pts = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 2 * 3); this.col = new Float32Array(max * 2 * 4);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.geo.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, depthTest: opts.depthTest ?? true });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    this.color = new THREE.Color(color); this.opts = opts;
  }
  set(points) { this.pts = points.slice(0, this.max); this.n = this.pts.length; }
  update(camera) {
    const n = this.n, P = this.pts, o = this.opts;
    const tmp = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3(), toCam = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const p = P[i];
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      t.subVectors(b, a).normalize();
      toCam.subVectors(camera.position, p).normalize();
      if (o.flat) side.set(-t.z, 0, t.x).normalize();
      else {
        side.crossVectors(t, toCam);
        // when the path points at the camera the cross product degenerates: fall back to horizontal
        if (side.length() < 0.35) side.set(-t.z, 0, t.x);
        side.normalize();
      }
      const dist = camera.position.distanceTo(p);
      const w = (o.width || 0.05) + dist * (o.grow ?? 0.0035);
      tmp.copy(p).addScaledVector(side, w);
      this.pos.set([tmp.x, tmp.y, tmp.z], i * 6);
      tmp.copy(p).addScaledVector(side, -w);
      this.pos.set([tmp.x, tmp.y, tmp.z], i * 6 + 3);
      let al = o.alphaFn ? o.alphaFn(i / Math.max(1, n - 1), i) : 1;
      al *= o.opacity ?? 1;
      const c = this.color;
      this.col.set([c.r, c.g, c.b, al, c.r, c.g, c.b, al], i * 8);
    }
    this.geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
    this.mesh.visible = n > 1;
  }
}

export function buildScene(world, opts = {}) {
  const hole = world.hole, C = world.climate, time = TIMES[hole.time] || TIMES.midday;
  const quality = opts.quality || engine.quality;
  const scene = new THREE.Scene();
  const disposables = [];
  // Environment ------------------------------------------------------------------------
  const el = time.elev * DEG, az = time.az * DEG;
  const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  let hor = C.sky.horizon, top = C.sky.top;
  if (hole.time === 'sunset') { hor = mix(hor, '#ffb27a', 0.6); top = mix(top, '#3a4f8a', 0.45); }
  if (hole.time === 'morning') { hor = mix(hor, '#ffe0c0', 0.35); top = mix(top, '#5a8ad8', 0.2); }
  const env = {
    sunDir, sunCol: new THREE.Color(time.sun), horizon: new THREE.Color(hor), top: new THREE.Color(top),
    groundHaze: new THREE.Color(mix(hor, C.sky.ground, 0.3)),
  };
  scene.fog = new THREE.Fog(new THREE.Color(hor), 320, 5200 / (time.haze || 1));
  scene.background = new THREE.Color(hor);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), skyMaterial(env, C.clouds));
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky); disposables.push(sky.geometry, sky.material);

  // Image-based lighting: prefilter the sky into an environment map so every surface gets
  // soft, directional sky light and subtle reflections.
  const pmrem = new THREE.PMREMGenerator(engine.renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial({ ...env, groundHaze: new THREE.Color(C.sky.ground).multiplyScalar(0.55) }, C.clouds * 0.7));
  envScene.add(envSky);
  const envRT = pmrem.fromScene(envScene, 0.02, 0.1, 200);
  pmrem.dispose();
  scene.environment = envRT.texture;
  const lowSun = time.elev < 20;
  scene.environmentIntensity = lowSun ? 0.9 : 0.6;
  engine.renderer.toneMappingExposure = lowSun ? 1.22 : 1.0;
  disposables.push(envRT, envSky.geometry, envSky.material);
  shared.sunCol.value.copy(env.sunCol);

  const hemi = new THREE.HemisphereLight(new THREE.Color(mix(top, '#ffffff', 0.5)), new THREE.Color(C.sky.ground), time.hemi * 0.9 + (time.elev < 20 ? 0.35 : 0));
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color(time.sun), time.int * (time.elev < 20 ? 1.25 : 1.0));
  sun.castShadow = quality !== 'low';
  const sm = quality === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 600;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // Terrain mesh -------------------------------------------------------------------------
  const { hw, hh, hr, x0, y0, x1, y1, heights } = world;
  const pos = new Float32Array(hw * hh * 3), uv = new Float32Array(hw * hh * 2);
  for (let j = 0; j < hh; j++) for (let i = 0; i < hw; i++) {
    const k = j * hw + i, x = x0 + i * hr, y = y0 + j * hr;
    pos[k * 3] = x; pos[k * 3 + 1] = heights[k]; pos[k * 3 + 2] = -y;
    uv[k * 2] = (x - x0) / (x1 - x0); uv[k * 2 + 1] = (y - y0) / (y1 - y0);
  }
  const idx = new Uint32Array((hw - 1) * (hh - 1) * 6);
  let q = 0;
  for (let j = 0; j < hh - 1; j++) for (let i = 0; i < hw - 1; i++) {
    const a = j * hw + i, b = a + 1, c = a + hw, d = c + 1;
    idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = a; idx[q++] = d; idx[q++] = c;
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tg.setIndex(new THREE.BufferAttribute(idx, 1));
  tg.computeVertexNormals();
  disposables.push(tg);
  // painted color map
  const maxTex = Math.min(engine.renderer.capabilities.maxTextureSize, quality === 'low' ? 2048 : 4096);
  const ppm = Math.min(quality === 'high' ? 5 : 4, maxTex / (x1 - x0), maxTex / (y1 - y0));
  const cv = document.createElement('canvas');
  cv.width = Math.round((x1 - x0) * ppm); cv.height = Math.round((y1 - y0) * ppm);
  const cctx = cv.getContext('2d');
  paintHole(cctx, hole, { scale: ppm, ox: x0, oy: y1 }, { mode: 'texture', world, bounds: { x0, y0, x1, y1 } });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = engine.renderer.capabilities.getMaxAnisotropy();
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  disposables.push(tex);
  const detail = new THREE.CanvasTexture(noiseCanvas(256, 6, 77, 1.6));
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping; disposables.push(detail);
  const grassD = repeatTex(grassDetailCanvas()), sandD = repeatTex(sandDetailCanvas());
  disposables.push(grassD, sandD);
  // per-surface mask: R grass, G sand/waste, B hard path, A short-mown turf
  const mask = surfaceMask(world);
  disposables.push(mask.tex);
  const tmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
  tmat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uDetail: { value: detail }, uGrassD: { value: grassD }, uSandD: { value: sandD }, uMask: { value: mask.tex }, uMaskXf: { value: mask.xf }, uBump: { value: 0.6 } });
    tmat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform sampler2D uDetail, uGrassD, uSandD, uMask; uniform vec4 uMaskXf; uniform float uBump;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 msk = texture2D(uMask, vec2((vWP.x - uMaskXf.x) / uMaskXf.z, (-vWP.z - uMaskXf.y) / uMaskXf.w));
        float camD = length(vWP - cameraPosition);
        float dfade = clamp(1.0 - camD / 110.0, 0.0, 1.0);
        float g1 = texture2D(uGrassD, vWP.xz * 1.15).r;
        float g2 = texture2D(uGrassD, vWP.xz * 0.31 + 0.37).r;
        float sg = texture2D(uSandD, vWP.xz * 1.9).r;
        float macro = texture2D(uDetail, vWP.xz * 0.05).r;
        float gd = mix(g1, g2, 0.35);
        float gAmp = mix(0.55, 0.26, msk.a);
        float dv = 1.0 + (gd - 0.5) * gAmp * 2.0;
        dv = mix(dv, 1.0 + (sg - 0.5) * 0.4, msk.g);
        dv = mix(dv, 1.0 + (sg - 0.5) * 0.22, msk.b);
        diffuseColor.rgb *= mix(1.0, dv, dfade) * (0.93 + macro * 0.14);
        float bumpH = mix(gd * mix(1.0, 0.45, msk.a), sg * 0.5, max(msk.g, msk.b)) * dfade;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 dpdx = normalize(dFdx(-vViewPosition)), dpdy = normalize(dFdy(-vViewPosition));
          float Hx = dFdx(bumpH) * uBump, Hy = dFdy(bumpH) * uBump;
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (Hx * r1 + Hy * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  disposables.push(tmat);
  const terrain = new THREE.Mesh(tg, tmat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Far terrain ring + backdrop --------------------------------------------------------------
  buildFar(scene, world, env, disposables, quality);

  // Water ------------------------------------------------------------------------------------
  for (const w of world.waters) {
    // grid over the pond carrying per-vertex depth (water level minus lake bed)
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const p of w.poly) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); }
    bx0 -= 2; by0 -= 2; bx1 += 2; by1 += 2;
    const res = Math.max(0.6, Math.max(bx1 - bx0, by1 - by0) / 140);
    const nx = Math.ceil((bx1 - bx0) / res) + 1, ny = Math.ceil((by1 - by0) / res) + 1;
    const vp = new Float32Array(nx * ny * 3), dep = new Float32Array(nx * ny), ins = new Float32Array(nx * ny), ix = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = bx0 + i * res, y = by0 + j * res, k = j * nx + i;
      vp.set([x, w.level, -y], k * 3);
      dep[k] = w.level - world.heightAt(x, y);
      ins[k] = !Number.isNaN(world.waterAt(x, y)) || pointInPoly(x, y, w.poly) ? 1 : 0;
    }
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; ix.push(a, d, b, a, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(vp, 3));
    g.setAttribute('aDepth', new THREE.BufferAttribute(dep, 1));
    g.setAttribute('aIn', new THREE.BufferAttribute(ins, 1));
    g.setIndex(ix);
    const wc = WATER_COLORS[w.shape.props.color] || WATER_COLORS.blue;
    const m = new THREE.Mesh(g, waterMaterial(env, wc.shallow, wc.deep, 0.93, 0.08, true));
    m.material.side = THREE.DoubleSide; m.renderOrder = 2;
    scene.add(m); disposables.push(g, m.material);
  }
  for (const cr of world.creeks) {
    const n = cr.pts.length, vp = [], ix = [], dep = [], ins = [];
    const K = 6; // vertices across the stream
    for (let i = 0; i < n; i++) {
      const a = cr.pts[Math.max(0, i - 1)], b = cr.pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = cr.halfW + 0.45, p = cr.pts[i], lv = cr.levels[i];
      for (let k = 0; k < K; k++) {
        const s = -1 + (2 * k) / (K - 1), x = p[0] - dy * w * s, y = p[1] + dx * w * s;
        vp.push(x, lv, -y); dep.push(lv - world.heightAt(x, y)); ins.push(1);
      }
      if (i < n - 1) for (let k = 0; k < K - 1; k++) { const q0 = i * K + k; ix.push(q0, q0 + 1, q0 + K, q0 + 1, q0 + K + 1, q0 + K); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); g.setIndex(ix);
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute('aIn', new THREE.Float32BufferAttribute(ins, 1));
    const m = new THREE.Mesh(g, waterMaterial(env, '#4a9ab0', '#1a4a5a', 0.9, 0.14, true));
    m.material.side = THREE.DoubleSide; m.renderOrder = 2;
    scene.add(m); disposables.push(g, m.material);
  }

  // Vegetation & objects ------------------------------------------------------------------------
  const treeMat = swayMaterial({ amp: 0.012, base: 2, side: THREE.DoubleSide });
  const shrubMat = swayMaterial({ amp: 0.06, base: 0.25, side: THREE.DoubleSide });
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const grassMat = swayMaterial({ amp: 0.35, base: 0.02, side: THREE.DoubleSide, rough: 0.95, trans: 0.3 });
  disposables.push(treeMat, shrubMat, rockMat, propMat, grassMat);
  const groups = new Map();
  const addInst = (o) => {
    if (!hasSpecies(o.kind)) return;
    const info = SPECIES_INFO[o.kind];
    const seed = o.seed ?? hashStr(o.kind + o.x.toFixed(1) + o.y.toFixed(1));
    const variant = info ? seed % info.v : 0;
    const lod = !!o.auto && (OBJ[o.kind]?.cat === 'tree' || OBJ[o.kind]?.cat === 'shrub') && o.kind !== 'reeds';
    const key = o.kind + ':' + variant + (lod ? ':lod' : '');
    if (!groups.has(key)) groups.set(key, { kind: o.kind, variant, lod, list: [] });
    groups.get(key).list.push({ ...o, seed });
  };
  for (const o of hole.objects) addInst(o);
  for (const o of world.decor) addInst(o);
  for (const o of world.farTrees || []) addInst(o);
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3(), yAx = new THREE.Vector3(0, 1, 0), cTmp = new THREE.Color();
  for (const g of groups.values()) {
    const geo = speciesGeometry(g.kind, g.variant, { fall: !!C.fall, lod: g.lod });
    const def = OBJ[g.kind];
    const cat = def?.cat;
    const mat = cat === 'tree' ? treeMat : cat === 'shrub' ? shrubMat : cat === 'rock' ? rockMat : propMat;
    const mesh = new THREE.InstancedMesh(geo, mat, g.list.length);
    const tiny = ['stake', 'plate', 'lily', 'teemarker', 'rake', 'flowers'].includes(g.kind);
    mesh.castShadow = !tiny && quality !== 'low'; mesh.receiveShadow = true;
    if (mat === treeMat || mat === shrubMat) mesh.customDepthMaterial = foliageDepthMaterial();
    g.list.forEach((o, i) => {
      const s = o.s || 1;
      let h = world.heightAt(o.x, o.y);
      if (g.kind === 'lily') h = (world.waterAt(o.x, o.y) || h) + 0.02;
      else if (g.kind === 'plate') h += 0.005;
      else if (cat === 'tree' || cat === 'rock') h -= 0.15 * s;
      qt.setFromAxisAngle(yAx, o.r || 0);
      m4.compose(vP.set(o.x, h, -o.y), qt, vS.set(s, s, s));
      mesh.setMatrixAt(i, m4);
      const rnd = mulberry32(o.seed || i);
      if (o.color || o.set) cTmp.set(o.color || ({ black: '#202020', blue: '#2a62d8', white: '#f5f5f5', gold: '#e8b830', red: '#d23a2e' })[o.set] || '#fff');
      else if (cat === 'tree' || cat === 'shrub') { const v = 0.82 + rnd() * 0.3; cTmp.setRGB(v * (0.95 + rnd() * 0.1), v, v * (0.9 + rnd() * 0.15)); }
      else cTmp.setRGB(1, 1, 1);
      mesh.setColorAt(i, cTmp);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  // Grass tufts
  // sample the painted ground so grass matches what it grows out of
  const img = cctx.getImageData(0, 0, cv.width, cv.height).data;
  const groundColor = (x, y, out) => {
    const px = clamp(Math.floor((x - x0) * ppm), 0, cv.width - 1), py = clamp(Math.floor((y1 - y) * ppm), 0, cv.height - 1);
    const k = (py * cv.width + px) * 4;
    return out.setRGB(img[k] / 255, img[k + 1] / 255, img[k + 2] / 255, THREE.SRGBColorSpace);
  };
  const tuftCount = quality === 'high' ? 18000 : quality === 'medium' ? 9000 : 0;
  if (tuftCount) scatterTufts(scene, world, grassMat, tuftCount, disposables, groundColor);
  // dense grass right around the ball (rebuilt for each shot)
  const near = { mesh: null, max: quality === 'high' ? 9000 : quality === 'medium' ? 4500 : 0 };
  if (near.max) {
    near.geo = tuftGeometry(5, 1);
    near.mesh = new THREE.InstancedMesh(near.geo, grassMat, near.max);
    near.mesh.count = 0; near.mesh.receiveShadow = true; near.mesh.frustumCulled = false;
    scene.add(near.mesh); disposables.push(near.geo);
  }
  function setNearGrass(bx, by) {
    if (!near.mesh) return;
    const R = 13, step = 0.32, m = new THREE.Matrix4(), q2 = new THREE.Quaternion(), p2 = new THREE.Vector3(), s2 = new THREE.Vector3(), c2 = new THREE.Color();
    let n = 0;
    const gx0 = Math.floor((bx - R) / step), gx1 = Math.ceil((bx + R) / step), gy0 = Math.floor((by - R) / step), gy1 = Math.ceil((by + R) / step);
    for (let j = gy0; j <= gy1 && n < near.max; j++) for (let i = gx0; i <= gx1 && n < near.max; i++) {
      const h1 = hashStr(i + ':' + j), r1 = (h1 % 1000) / 1000, r2 = ((h1 >> 10) % 1000) / 1000, r3 = ((h1 >> 20) % 1000) / 1000;
      const x = (i + r1) * step, y = (j + r2) * step;
      const d = Math.hypot(x - bx, y - by);
      if (d > R || d < 0.12) continue;
      const s = world.surfAt(x, y);
      let ht, p;
      if (s === S.ROUGH) { ht = 0.09 + r3 * 0.08; p = 0.85; }
      else if (s === S.DEEP) { ht = 0.25 + r3 * 0.25; p = 1; }
      else if (s === S.FIRSTCUT) { ht = 0.045 + r3 * 0.02; p = 0.7; }
      else if (s === S.FAIRWAY || s === S.TEE) { ht = 0.025 + r3 * 0.01; p = 0.55; }
      else if (s === S.NATIVE && world.hole.ground !== 'native') { ht = 0.12; p = 0.3; }
      else continue;
      if (r3 > p || !Number.isNaN(world.waterAt(x, y))) continue;
      q2.setFromAxisAngle(yAx, r1 * 6.28);
      m.compose(p2.set(x, world.heightAt(x, y) - 0.005, -y), q2, s2.set(ht * (0.9 + r2 * 0.4), ht, ht * (0.9 + r2 * 0.4)));
      near.mesh.setMatrixAt(n, m);
      groundColor(x, y, c2).multiplyScalar(0.9 + r2 * 0.25);
      near.mesh.setColorAt(n, c2);
      n++;
    }
    near.mesh.count = n;
    near.mesh.instanceMatrix.needsUpdate = true;
    if (near.mesh.instanceColor) near.mesh.instanceColor.needsUpdate = true;
  }
  // Fountains
  const fountains = world.decor.filter((d) => d.kind === 'fountain');
  for (const f of fountains) scene.add(makeFountain(f, disposables));

  // Pin, cup, ball ------------------------------------------------------------------------------
  const pinH = world.heightAt(world.pin.x, world.pin.y);
  const pinGroup = new THREE.Group(); pinGroup.position.set(world.pin.x, pinH, -world.pin.y);
  const n = world.normalAt(world.pin.x, world.pin.y);
  const cupGeo = new THREE.CircleGeometry(0.054, 24).rotateX(-Math.PI / 2);
  const cup = new THREE.Mesh(cupGeo, new THREE.MeshBasicMaterial({ color: 0x0b0b0b, polygonOffset: true, polygonOffsetFactor: -2 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.046, 0.054, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2f2f2, polygonOffset: true, polygonOffsetFactor: -3 }));
  const cupHolder = new THREE.Group();
  cupHolder.quaternion.setFromUnitVectors(yAx, new THREE.Vector3(n[0], n[2], -n[1]));
  cupHolder.position.y = 0.004; cupHolder.add(cup, ring); pinGroup.add(cupHolder);
  const cupGlow = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  cupGlow.visible = false; cupHolder.add(cupGlow);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.3, 8).translate(0, 1.15, 0), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 }));
  pole.castShadow = true;
  const poleBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.3, 8).translate(0, 0.15, 0), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  const flagGeo = new THREE.PlaneGeometry(0.55, 0.36, 12, 4).translate(0.275, 0, 0);
  const flagBase = flagGeo.attributes.position.array.slice();
  const flagMat = new THREE.MeshStandardMaterial({ color: opts.flagColor || 0xf2c41a, side: THREE.DoubleSide, roughness: 0.8 });
  const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.y = 2.1; flag.castShadow = true;
  const flagPivot = new THREE.Group(); flagPivot.add(flag);
  const flagStick = new THREE.Group(); flagStick.add(pole, poleBand, flagPivot);
  pinGroup.add(flagStick);
  scene.add(pinGroup);
  disposables.push(cupGeo, flagGeo, pole.geometry);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x222222 }));
  ball.castShadow = true;
  scene.add(ball);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  scene.add(ballShadow);

  // overlays
  const tracer = new Ribbon(900, 0xffffff, { width: 0.004, grow: 0.0034, alphaFn: (t) => 0.1 + 0.8 * t });
  const aimArc = new Ribbon(200, 0xffffff, { width: 0, grow: 0.0021, alphaFn: (t, i) => (i % 2 ? 0.0 : 0.85) * (1 - t * 0.4) });
  const puttLine = new Ribbon(400, 0xffffff, { width: 0.012, grow: 0.0008, flat: true, alphaFn: (t, i) => ((i >> 1) % 2 ? 0.0 : 0.9) * (1 - t * 0.7) });
  scene.add(tracer.mesh, aimArc.mesh, puttLine.mesh);
  const target = new THREE.Group();
  const tRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  const tDot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
  const tRing2 = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.46, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd34a, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
  target.add(tRing, tRing2, tDot); target.renderOrder = 6;
  for (const c of target.children) { c.renderOrder = 6; c.material.depthTest = false; }
  scene.add(target);

  // golfer
  const golfer = buildGolfer(getSettings().golfer);
  scene.add(golfer.group);

  // Green reading grid
  let grid = null;
  function setGreenGrid(green) {
    if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid = null; }
    if (!green) return;
    grid = buildGreenGrid(world, green);
    scene.add(grid);
  }

  const windVec = opts.wind ? new THREE.Vector2(opts.wind.x, -opts.wind.y) : new THREE.Vector2(0.5, 0);
  shared.wind.value.copy(windVec).multiplyScalar(0.25);
  const windAngle = Math.atan2(-windVec.y, windVec.x);
  flagPivot.rotation.y = -windAngle + 0;
  const ws = windVec.length();

  function update(dt, t, camera, focus) {
    shared.time.value = t;
    sky.position.copy(camera.position);
    shared.sunView.value.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    // flag wave
    const P = flagGeo.attributes.position.array;
    const amp = 0.02 + Math.min(0.12, ws * 0.012), speed = 4 + ws * 1.2;
    for (let i = 0; i < P.length; i += 3) {
      const x = flagBase[i];
      P[i + 2] = Math.sin(x * 9 - t * speed) * amp * (x / 0.55) + Math.sin(x * 17 - t * speed * 1.7) * amp * 0.3 * (x / 0.55);
      P[i + 1] = flagBase[i + 1] - x * Math.max(0, 0.25 - ws * 0.03);
    }
    flagGeo.attributes.position.needsUpdate = true;
    flagGeo.computeVertexNormals();
    if (focus) {
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(sunDir, 300);
      sun.target.updateMatrixWorld();
    }
    tracer.update(camera); aimArc.update(camera); puttLine.update(camera);
    if (grid) grid.material.uniforms.uTime.value = t;
    for (const f of fountains) if (f.mat) f.mat.uniforms.uTime.value = t;
  }
  function dispose() {
    for (const d of disposables) d.dispose?.();
    scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    if (grid) { grid.geometry.dispose(); grid.material.dispose(); }
    tracer.geo.dispose(); aimArc.geo.dispose(); puttLine.geo.dispose();
  }
  return { scene, env, sun, sunDir, update, dispose, ball, ballShadow, tracer, aimArc, puttLine, target, golfer, setGreenGrid, pinGroup, flagStick, terrain, cupGlow, setNearGrass };
}

// Ground micro-detail textures ---------------------------------------------------------------
const detailCache = {};
function wrapDraw(g, S, fn) { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } }
function grassDetailCanvas() {
  if (detailCache.grass) return detailCache.grass;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), rnd = mulberry32(31337);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, S);
  g.lineCap = 'round';
  for (let i = 0; i < 4200; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI * 2, l = 3 + rnd() * 7, v = 60 + rnd() * 160;
    g.strokeStyle = `rgba(${v | 0},${v | 0},${v | 0},0.55)`; g.lineWidth = 0.8 + rnd() * 1.2;
    wrapDraw(g, S, () => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); });
  }
  return (detailCache.grass = c);
}
function sandDetailCanvas() {
  if (detailCache.sand) return detailCache.sand;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), rnd = mulberry32(4242);
  for (let i = 0; i < S * S; i++) { const v = 128 + (rnd() - 0.5) * 120 * (rnd() < 0.1 ? 1.6 : 0.6); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 300; i++) { const v = 90 + rnd() * 120; g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; const x = rnd() * S, y = rnd() * S, r = 0.8 + rnd() * 1.6; wrapDraw(g, S, () => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }
  return (detailCache.sand = c);
}
function repeatTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = Math.min(8, engine.renderer.capabilities.getMaxAnisotropy());
  return t;
}
function surfaceMask(world) {
  const f = 2, w = Math.ceil(world.sw / f), h = Math.ceil(world.sh / f);
  const data = new Uint8Array(w * h * 4);
  const GRASS = new Set([S.ROUGH, S.DEEP, S.FIRSTCUT, S.OOB, S.FAIRWAY, S.TEE, S.FRINGE, S.GREEN]);
  const SHORT = new Set([S.FAIRWAY, S.TEE, S.FRINGE, S.GREEN, S.FIRSTCUT]);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const s = world.surf[Math.min(world.sh - 1, j * f) * world.sw + Math.min(world.sw - 1, i * f)];
    const k = (j * w + i) * 4;
    data[k] = GRASS.has(s) ? 255 : 0;
    data[k + 1] = s === S.BUNKER || s === S.NATIVE ? 255 : 0;
    data[k + 2] = s === S.PATH || s === S.MULCH ? 255 : 0;
    data[k + 3] = SHORT.has(s) ? 255 : 0;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return { tex, xf: new THREE.Vector4(world.x0, world.y0, w * f * world.sr, h * f * world.sr) };
}

function scatterTufts(scene, world, mat, count, disposables, groundColor) {
  const rnd = mulberry32(world.hole.terrain.seed + 99);
  const C = world.climate.c;
  const kinds = [
    { geo: tuftGeometry(0, 0.3), list: [] },
    { geo: tuftGeometry(1, 0.6), list: [] },
  ];
  const R = world.rect;
  const rough = new THREE.Color(C.tuft), deep = new THREE.Color(C.deep).lerp(new THREE.Color(C.tuft), 0.5), native = new THREE.Color(C.nativeSpeck);
  const gc = new THREE.Color();
  const tint = (base, x, y) => (groundColor ? groundColor(x, y, gc).clone().lerp(base, 0.3) : base);
  let tries = 0, placed = 0;
  const pad = 25;
  while (placed < count && tries < count * 8) {
    tries++;
    const x = R.x0 - pad + rnd() * (R.x1 - R.x0 + pad * 2), y = R.y0 - pad + rnd() * (R.y1 - R.y0 + pad * 2);
    const s = world.surfAt(x, y);
    let p = 0, k = 0, c = rough, sc = 1;
    if (s === S.ROUGH) { p = 0.32; c = rough; sc = 0.8 + rnd() * 0.5; }
    else if (s === S.DEEP) { p = 1; k = 1; c = deep; sc = 0.9 + rnd() * 0.8; }
    else if (s === S.NATIVE) { p = world.hole.ground === 'native' ? 0.12 : 0.3; k = rnd() < 0.5 ? 1 : 0; c = native; sc = 0.7 + rnd() * 0.5; }
    else if (s === S.FIRSTCUT) { p = 0.04; c = rough; sc = 0.5; }
    else continue;
    if (rnd() > p) continue;
    if (!Number.isNaN(world.waterAt(x, y))) continue;
    kinds[k].list.push([x, y, sc, tint(c, x, y)]);
    placed++;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAx = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sv = new THREE.Vector3();
  const tc = new THREE.Color();
  for (const kd of kinds) {
    if (!kd.list.length) continue;
    const mesh = new THREE.InstancedMesh(kd.geo, mat, kd.list.length);
    kd.list.forEach(([x, y, s, c], i) => {
      q.setFromAxisAngle(yAx, rnd() * 6.28);
      m4.compose(v.set(x, world.heightAt(x, y) - 0.02, -y), q, sv.set(s, s * (0.8 + rnd() * 0.5), s));
      mesh.setMatrixAt(i, m4);
      tc.copy(c).multiplyScalar(0.85 + rnd() * 0.3); mesh.setColorAt(i, tc);
    });
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh); disposables.push(kd.geo);
  }
}

function makeFountain(f, disposables) {
  const N = 500, g = new THREE.BufferGeometry();
  const p = new Float32Array(N * 3), a = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { a[i * 4] = Math.random(); a[i * 4 + 1] = Math.random() * 6.28; a[i * 4 + 2] = 5 + Math.random() * 2.5; a[i * 4 + 3] = 0.5 + Math.random() * 1.2; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aP', new THREE.BufferAttribute(a, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute vec4 aP; uniform float uTime; varying float vA;
      void main(){ float t = fract(uTime*0.55 + aP.x); float vy = aP.z; float r = aP.w * t;
      vec3 pos = vec3(cos(aP.y)*r, vy*t - 4.9*t*t*1.6, sin(aP.y)*r);
      vA = 1.0 - t; vec4 mv = modelViewMatrix * vec4(pos,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(140.0 / -mv.z, 1.0, 9.0); }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(0.85,0.93,1.0, (0.5 - d) * 1.2 * vA); }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.position.set(f.x, f.level, -f.y); pts.frustumCulled = false;
  f.mat = mat;
  disposables.push(g, mat);
  return pts;
}

function buildGreenGrid(world, green) {
  const poly = green.poly;
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const p of poly) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); }
  bx0 -= 3; by0 -= 3; bx1 += 3; by1 += 3;
  const res = 0.5, nx = Math.ceil((bx1 - bx0) / res) + 1, ny = Math.ceil((by1 - by0) / res) + 1;
  const pos = new Float32Array(nx * ny * 3), sl = new Float32Array(nx * ny * 3);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = bx0 + i * res, y = by0 + j * res, k = j * nx + i;
    const h = world.heightAt(x, y);
    const e = 0.4;
    const gx = (world.heightAt(x + e, y) - world.heightAt(x - e, y)) / (2 * e), gy = (world.heightAt(x, y + e) - world.heightAt(x, y - e)) / (2 * e);
    pos.set([x, h + 0.025, -y], k * 3);
    const inside = pointInPoly(x, y, poly) ? 1 : 0;
    sl.set([gx, -gy, inside], k * 3);
  }
  // soften mask
  const ix = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; ix.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSlope', new THREE.BufferAttribute(sl, 3)); g.setIndex(ix);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute vec3 aSlope; varying vec3 vS; varying vec2 vXZ; void main(){ vS = aSlope; vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec3 vS; varying vec2 vXZ;
      void main(){
        vec2 g = vS.xy; float s = length(g) * 100.0;
        vec2 q = vXZ / 1.0; vec2 w = abs(fract(q - 0.5) - 0.5) / (fwidth(q) * 1.6); float line = 1.0 - min(min(w.x, w.y), 1.0);
        vec3 c = s < 1.0 ? mix(vec3(0.35,0.65,1.0), vec3(0.45,1.0,0.6), s) : s < 2.5 ? mix(vec3(0.45,1.0,0.6), vec3(1.0,0.9,0.3), (s-1.0)/1.5) : mix(vec3(1.0,0.9,0.3), vec3(1.0,0.32,0.22), clamp((s-2.5)/2.0,0.0,1.0));
        vec2 d = normalize(-g + vec2(1e-6));
        float along = dot(vXZ, d), across = dot(vXZ, vec2(-d.y, d.x));
        vec2 cell = vec2(fract(along * 1.0 - uTime * (0.25 + s * 0.18)) - 0.5, fract(across * 1.0) - 0.5);
        float dotv = smoothstep(0.13, 0.04, length(cell * vec2(0.7, 1.0)));
        float a = (line * 0.7 + dotv * 0.9) * vS.z;
        gl_FragColor = vec4(mix(vec3(1.0), c, 0.85), a);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 4;
  return mesh;
}

// Far surroundings ------------------------------------------------------------------------------------
function buildFar(scene, world, env, disposables, quality) {
  const C = world.climate, hole = world.hole;
  const { x0, y0, x1, y1 } = world;
  const rnd = mulberry32(hole.terrain.seed + 5);
  const D = [0, 8, 20, 36, 56, 80, 110, 150, 200, 260, 340, 440, 570, 740, 960, 1250, 1650, 2200, 3000, 4200];
  const perim = 2 * ((x1 - x0) + (y1 - y0));
  const N = Math.ceil(perim / 12);
  const back = C.backdrop;
  const clampDom = (x, y) => [clamp(x, x0, x1), clamp(y, y0, y1)];
  const amp = { hills: 18, mountains: 45, mesas: 6, volcano: 22, ocean: 5 }[back] ?? 12;
  const oceanSide = back === 'ocean' || back === 'volcano' ? (hole.terrain.seed % 2 ? 1 : -1) : 0;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const heightFar = (x, y, d) => {
    const [px, py] = clampDom(x, y);
    let h = world.plane(px, py) + fbm(x / 160, y / 160, 3, 4) * amp * smoothstep(0, 220, d) + fbm(x / 40, y / 40, 8, 2) * 2 * smoothstep(0, 60, d);
    if (back === 'mountains') h += Math.max(0, fbm(x / 500, y / 500, 11, 3)) * 160 * smoothstep(300, 1500, d);
    if (oceanSide && (x - cx) * oceanSide > 0) h = h * (1 - smoothstep(60, 260, d)) + (-6) * smoothstep(60, 260, d);
    return h;
  };
  const pts = [], cols = [];
  const ground = new THREE.Color(hole.ground === 'native' ? C.c.native : C.c.rough);
  const far = new THREE.Color(hole.ground === 'native' ? C.c.native : C.c.deep);
  const perimPt = (u, d) => {
    const ax0 = x0 - d, ax1 = x1 + d, ay0 = y0 - d, ay1 = y1 + d;
    const w = ax1 - ax0, h = ay1 - ay0, L = 2 * (w + h);
    let s = u * L;
    if (s < w) return [ax0 + s, ay0]; s -= w;
    if (s < h) return [ax1, ay0 + s]; s -= h;
    if (s < w) return [ax1 - s, ay1]; s -= w;
    return [ax0, ay1 - s];
  };
  // inner ring must hit domain corners exactly: sample u from perimeter positions of the domain
  const us = [];
  const W0 = x1 - x0, H0 = y1 - y0, L0 = 2 * (W0 + H0);
  const pushSide = (len, n) => { for (let i = 0; i < n; i++) us.push((us.length ? 0 : 0) + 0); void len; };
  void pushSide;
  const corners = [0, W0 / L0, (W0 + H0) / L0, (2 * W0 + H0) / L0, 1];
  for (let c = 0; c < 4; c++) {
    const a = corners[c], b = corners[c + 1], n = Math.max(2, Math.round((b - a) * N));
    for (let i = 0; i < n; i++) us.push(a + (b - a) * (i / n));
  }
  const M = us.length;
  for (let k = 0; k < D.length; k++) {
    for (let i = 0; i < M; i++) {
      const [x, y] = perimPt(us[i], D[k]);
      const h = heightFar(x, y, D[k]);
      pts.push(x, h, -y);
      const t = clamp(D[k] / 400, 0, 1);
      const c = ground.clone().lerp(far, t * 0.6).multiplyScalar(0.92 + fbm(x / 60, y / 60, 4, 2) * 0.16);
      if (oceanSide && (x - cx) * oceanSide > 0 && h < -1) c.set(C.c.native);
      cols.push(c.r, c.g, c.b);
    }
  }
  const ix = [];
  for (let k = 0; k < D.length - 1; k++) for (let i = 0; i < M; i++) {
    const a = k * M + i, b = k * M + ((i + 1) % M), c = (k + 1) * M + i, d = (k + 1) * M + ((i + 1) % M);
    ix.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(ix); g.computeVertexNormals();
  // make sure faces point up
  const nrm = g.attributes.normal;
  let upCount = 0;
  for (let i = 0; i < nrm.count; i++) upCount += nrm.getY(i);
  if (upCount < 0) { for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.setIndex(ix); g.computeVertexNormals(); }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true;
  scene.add(mesh); disposables.push(g, mat);

  // ocean
  if (oceanSide) {
    const og = new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2);
    const wc = WATER_COLORS[C.water] || WATER_COLORS.blue;
    const om = new THREE.Mesh(og, waterMaterial(env, wc.shallow, wc.deep, 1, 0.02));
    om.position.set(cx + oceanSide * (4500 + (x1 - x0) / 2 + 120), -2.2, -cy);
    scene.add(om); disposables.push(og, om.material);
  }
  // far trees
  const kinds = C.surround;
  const trees = [];
  const count = quality === 'low' ? 100 : quality === 'medium' ? 200 : 300;
  const dens = C.surroundDensity;
  for (let i = 0; i < count * dens; i++) {
    const u = rnd(), d = 4 + Math.pow(rnd(), 1.6) * 320;
    const [x, y] = perimPt(u, d);
    if (oceanSide && (x - cx) * oceanSide > 0 && d > 70) continue;
    if (fbm(x / 70, y / 70, 17, 2) < -0.2) continue;
    trees.push({ kind: kinds[Math.floor(rnd() * kinds.length)], x, y, s: 0.9 + rnd() * 0.6, r: rnd() * 6.28, seed: Math.floor(rnd() * 1e6), h: heightFar(x, y, d) });
  }
  const groups = new Map();
  for (const t of trees) { const info = SPECIES_INFO[t.kind]; const v = info ? t.seed % info.v : 0; const k = t.kind + v; if (!groups.has(k)) groups.set(k, { kind: t.kind, v, list: [] }); groups.get(k).list.push(t); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yAx = new THREE.Vector3(0, 1, 0), vp = new THREE.Vector3(), vs = new THREE.Vector3();
  const tmat = swayMaterial({ amp: 0.008, base: 2 });
  disposables.push(tmat);
  for (const gr of groups.values()) {
    const geo = speciesGeometry(gr.kind, gr.v, { fall: !!C.fall, lod: true });
    if (!geo) continue;
    const im = new THREE.InstancedMesh(geo, OBJ[gr.kind]?.cat === 'rock' ? new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }) : tmat, gr.list.length);
    const tc = new THREE.Color();
    gr.list.forEach((t, i) => {
      q.setFromAxisAngle(yAx, t.r); m4.compose(vp.set(t.x, t.h - 0.2, -t.y), q, vs.set(t.s, t.s, t.s)); im.setMatrixAt(i, m4);
      const v = 0.8 + (t.seed % 100) / 330; tc.setRGB(v, v * (0.97 + (t.seed % 7) / 100), v * 0.95); im.setColorAt(i, tc);
    });
    im.computeBoundingSphere();
    scene.add(im);
  }
  // distant landscape: a ring-shaped heightfield (ridges, rock, snow, forest) with baked sun shading;
  // fog supplies aerial perspective so ranges fade into the haze
  const segs = 384, rows = 14, R0 = 1500, R1 = 3100;
  const sunDirX = env.sunDir.x, sunDirY = env.sunDir.y, sunDirZ = env.sunDir.z;
  const ridged = (x, y, s) => 1 - Math.abs(fbm(x, y, s, 4));
  const isOcean = (a) => oceanSide && Math.cos(a) * oceanSide > 0.12;
  const heightAt = (a, t) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    const X = ca * (2 + t * 1.5), Y = sa * (2 + t * 1.5);
    const rise = smoothstep(0, 0.55, t);
    if (isOcean(a)) return -30;
    if (back === 'mountains') return rise * (120 + Math.max(0, fbm(X * 0.9, Y * 0.9, 21, 4) + 0.35) * 820 + ridged(X * 3, Y * 3, 22) * 260 * t);
    if (back === 'mesas') {
      const m = fbm(X * 1.2, Y * 1.2, 23, 3) + (t - 0.5) * 0.25;
      const plateau = smoothstep(-0.02, 0.06, m) * (150 + fbm(X * 3, Y * 3, 4, 2) * 30) + smoothstep(0.18, 0.24, m) * 70;
      return rise * (20 + plateau + Math.max(0, fbm(X * 6, Y * 6, 8, 3)) * 25);
    }
    if (back === 'volcano') {
      const va = oceanSide > 0 ? Math.PI : 0;
      const dA = Math.abs(((a - va) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const cone = Math.max(0, 1 - Math.hypot(dA / 0.55, (t - 0.6) / 0.45)) ** 1.2 * 720;
      return rise * (40 + cone + fbm(X * 3, Y * 3, 9, 4) * 60 + ridged(X * 5, Y * 5, 3) * 40);
    }
    if (back === 'ocean') return rise * (25 + fbm(X * 2.5, Y * 2.5, 5, 3) * 40);
    return rise * (40 + (fbm(X * 1.4, Y * 1.4, 25, 4) + 0.4) * 140 + fbm(X * 6, Y * 6, 26, 2) * 20);
  };
  const bp = new Float32Array((segs + 1) * rows * 3), hgts = new Float32Array((segs + 1) * rows);
  for (let i = 0; i <= segs; i++) for (let r = 0; r < rows; r++) {
    const a = (i / segs) * Math.PI * 2, t = r / (rows - 1), rad = R0 + (R1 - R0) * t;
    const hgt = heightAt(a, t) - 40 * (1 - t);
    const k = i * rows + r;
    hgts[k] = hgt;
    bp.set([cx + Math.cos(a) * rad, hgt, -cy + Math.sin(a) * rad], k * 3);
  }
  const bi = [];
  for (let i = 0; i < segs; i++) for (let r = 0; r < rows - 1; r++) {
    const a = i * rows + r, b = (i + 1) * rows + r;
    bi.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.setIndex(bi);
  bg.computeVertexNormals();
  const BN = bg.attributes.normal, bc = new Float32Array(bp.length);
  const P = {
    mountains: { low: '#2e4a33', mid: '#646b70', high: '#8a9096', snow: '#f2f5f8' },
    mesas: { low: '#9a6a44', mid: '#b5703f', high: '#d39a65', snow: '#c98a55' },
    volcano: { low: '#2f5530', mid: '#3d6638', high: '#55704a', snow: '#6a6458' },
    ocean: { low: '#7d9450', mid: '#8fa262', high: '#a8ad78', snow: '#a8ad78' },
    hills: { low: '#3a5a32', mid: C.fall ? '#9a5a2a' : '#46663a', high: C.fall ? '#b07a34' : '#55744a', snow: '#5d7a4f' },
  }[back] || { low: '#3a5a32', mid: '#46663a', high: '#55744a', snow: '#5d7a4f' };
  const cl = { low: new THREE.Color(P.low), mid: new THREE.Color(P.mid), high: new THREE.Color(P.high), snow: new THREE.Color(P.snow) };
  const tc = new THREE.Color();
  for (let k = 0; k < hgts.length; k++) {
    const hgt = hgts[k], ny = BN.getY(k);
    const x = bp[k * 3], z = bp[k * 3 + 2];
    const n1 = fbm(x / 140, z / 140, 41, 3);
    if (back === 'mountains') {
      const snowline = 560 + n1 * 140;
      if (hgt > snowline && ny > 0.45) tc.copy(cl.snow);
      else if (hgt > 260 + n1 * 80) tc.copy(cl.mid).lerp(cl.high, smoothstep(260, 700, hgt));
      else tc.copy(cl.low).lerp(cl.mid, smoothstep(120, 300, hgt));
    } else if (back === 'mesas') {
      tc.copy(cl.mid).lerp(cl.high, 0.5 + 0.5 * Math.sin(hgt * 0.09 + n1 * 2));
      if (ny > 0.85) tc.lerp(cl.low, 0.4);
    } else tc.copy(cl.low).lerp(cl.mid, smoothstep(30, 140, hgt) + n1 * 0.3).lerp(cl.high, ny > 0.9 ? 0.25 : 0);
    // baked lighting: sun diffuse + sky fill
    const lit = Math.max(0, BN.getX(k) * sunDirX + BN.getY(k) * sunDirY + BN.getZ(k) * sunDirZ);
    tc.multiplyScalar(0.42 + lit * 0.85 + ny * 0.12);
    bc.set([tc.r, tc.g, tc.b], k * 3);
  }
  bg.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  const bmat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
  const bmesh = new THREE.Mesh(bg, bmat);
  scene.add(bmesh); disposables.push(bg, bmat);
}
