import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  DRONE_META, createDrone, createDock, setDockOpen, updateDock,
  createMissionMap, getShared, MISSION_POINTS
} from './models.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = $('#scene');
const loader = $('#loader');
const loaderBar = $('#loaderBar');
const loaderPct = $('#loaderPct');
const hotspotsLayer = $('#hotspots');
const comparePanel = $('.compare-panel');
const filterHint = $('#filterHint');
const missionReadout = $('#missionReadout');

let renderer, scene, camera, clock;
let ready = false;
let webglOk = true;
let selectedType = '4T';
let activeSection = 'hero';
let activeScene = 'hero';
let activeStageKey = '';
let pointerX = 0, pointerY = 0;
let orbitYaw = 0, orbitPitch = 0;
let dragging = false, dragMoved = false, lastPX = 0, lastPY = 0;
let selectedDetail = null;
let stageLight;
let missionMap;
let heroDrone, heroDock, dock3, dock4, dock4Drones = [], lineupDrones = [];
let detailDrones = {};
let activeMission = 0;
let userInteracted = false;

const stages = {};
const cam = { dist: 14, elev: .14, yaw: .22, fov: 34, tx: 0, ty: 1.3, tz: 0 };
let camTarget = { ...cam };

const MISSION_COLORS = [0xff6b1a, 0xffc857, 0x5ec8ff, 0x43e2b2, 0xff8a4c, 0x9f8cff];

function updateLoader(p) {
  if (loaderBar) loaderBar.style.width = `${p}%`;
  if (loaderPct) loaderPct.textContent = String(Math.round(p)).padStart(2, '0');
}

function showFallback() {
  webglOk = false;
  document.documentElement.classList.add('no-webgl');
  document.body.classList.add('is-loaded');
  if (loader) {
    loader.classList.add('is-done');
    setTimeout(() => { loader.style.display = 'none'; }, 900);
  }
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.error(err);
    showFallback();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04080c, .026);
  camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, .1, 160);
  clock = new THREE.Clock();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), .05).texture;
  scene.environment = env;
  scene.environmentIntensity = .62;

  buildLights();
  buildWorld();
  buildStages();
  layoutStages();
  bindUI();
  applyModel(selectedType, false);
  setActiveSection('hero', true);
  updateLoader(88);

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });
  window.addEventListener('dblclick', (e) => {
    if (e.target.closest('a,button,table,input,textarea,select')) return;
    orbitYaw = 0; orbitPitch = 0;
  });

  onScroll();
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
    updateLoader(100);
    setTimeout(() => {
      ready = true;
      document.body.classList.add('is-loaded');
      loader.classList.add('is-done');
      setTimeout(() => { loader.style.display = 'none'; }, 900);
    }, reducedMotion ? 180 : 520);
    animate();
  });
}

function buildLights() {
  const hemi = new THREE.HemisphereLight(0x86b7d2, 0x05080b, .62);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xf5fbff, 3.1);
  key.position.set(7, 11, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 45;
  key.shadow.bias = -.0004;
  key.shadow.normalBias = .02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x68d6ff, 1.65);
  fill.position.set(-9, 6, 5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xff7334, 1.4);
  rim.position.set(4, 4, -9);
  scene.add(rim);

  stageLight = new THREE.PointLight(0xff6b1a, 22, 18, 2);
  stageLight.position.set(3.5, 2.2, 4.5);
  scene.add(stageLight);

  const lower = new THREE.PointLight(0x17627c, 14, 25, 2);
  lower.position.set(-5, -1, 4);
  scene.add(lower);
}

function buildWorld() {
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x04080b, roughness: .76, metalness: .55 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.18;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(100, 100, 0x1b3b49, 0x0a1a22);
  grid.position.y = -2.16;
  grid.material.transparent = true;
  grid.material.opacity = .26;
  scene.add(grid);

  const noiseTex = getShared().noise;
  const groundGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshBasicMaterial({ map: noiseTex, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = -2.15;
  scene.add(groundGlow);

  const horizon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getShared().glow, color: 0x1b6480, transparent: true, opacity: .16,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  horizon.scale.set(44, 24, 1);
  horizon.position.set(0, 4, -24);
  scene.add(horizon);

  const warm = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getShared().glow, color: 0xff6b1a, transparent: true, opacity: .09,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  warm.scale.set(20, 14, 1);
  warm.position.set(9, .5, -12);
  scene.add(warm);

  const dustGeo = new THREE.BufferGeometry();
  const count = window.innerWidth < 760 ? 140 : 300;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * 30;
    positions[i * 3 + 1] = Math.random() * 11 - 1.5;
    positions[i * 3 + 2] = (Math.random() - .5) * 22 - 1;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x93d6e9, size: .035, map: getShared().dot, transparent: true, opacity: .46,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  dust.name = 'dust';
  scene.add(dust);
  scene.userData.dust = dust;
}

function buildStages() {
  const hero = new THREE.Group();
  heroDock = createDock(4);
  heroDock.position.set(0, 0, 0);
  setDockOpen(heroDock, 1);
  hero.add(heroDock);
  heroDrone = createDrone('5TD');
  heroDrone.scale.multiplyScalar(.78);
  heroDrone.position.set(0, 3.3, 0);
  heroDrone.rotation.y = .15;
  hero.add(heroDrone);
  scene.add(hero);
  stages.hero = hero;

  const lineup = new THREE.Group();
  const lineTypes = ['4T', '4E', '4TD', '5TD'];
  lineTypes.forEach((type, i) => {
    const d = createDrone(type);
    d.scale.setScalar(d.userData.meta.scale * .68);
    d.rotation.y = [.34, .1, -.18, -.36][i];
    d.userData.baseY = .55 + [0, .18, .02, .2][i];
    d.position.set(-5.85 + i * 3.9, d.userData.baseY, [.25, -.18, .12, -.25][i]);
    d.userData.phase = i * 1.3;
    d.userData.ringGroup.visible = false;
    lineupDrones.push(d);
    lineup.add(d);
  });
  lineup.position.y = .15;
  scene.add(lineup);
  stages.lineup = lineup;

  const docksStage = new THREE.Group();
  dock3 = createDock(3);
  dock3.position.set(-4.1, -.2, 0);
  setDockOpen(dock3, .92);
  docksStage.add(dock3);
  dock4 = createDock(4);
  dock4.position.set(4.1, -.2, 0);
  setDockOpen(dock4, .92);
  docksStage.add(dock4);
  const d4td = createDrone('4TD');
  d4td.scale.multiplyScalar(.53);
  d4td.position.set(-4.1, 2.65, 0);
  d4td.userData.ringGroup.visible = false;
  docksStage.add(d4td);
  const d5td = createDrone('5TD');
  d5td.scale.multiplyScalar(.53);
  d5td.position.set(4.1, 2.72, 0);
  d5td.userData.ringGroup.visible = false;
  docksStage.add(d5td);
  dock4Drones = [d4td, d5td];
  scene.add(docksStage);
  stages.docks = docksStage;

  const detail = new THREE.Group();
  Object.keys(DRONE_META).forEach((type) => {
    const d = createDrone(type);
    d.position.set(2.75, .72, 0);
    d.visible = false;
    d.userData.baseScale = d.userData.meta.scale;
    d.userData.detail = true;
    detailDrones[type] = d;
    detail.add(d);
  });
  scene.add(detail);
  stages.detail = detail;
  selectedDetail = detailDrones[selectedType];
  selectedDetail.visible = true;

  missionMap = createMissionMap();
  missionMap.scale.setScalar(.92);
  missionMap.position.y = -2.08;
  scene.add(missionMap);
  stages.missions = missionMap;

  Object.entries(stages).forEach(([key, group]) => {
    group.visible = key === 'hero';
    group.userData.key = key;
  });
  activeStageKey = 'hero';
  
}

function layoutStages() {
  const mobile = window.innerWidth <= 1400;
  const narrow = window.innerWidth <= 680;
  const tablet = mobile && !narrow;

  stages.hero.position.x = mobile ? (window.innerWidth > 900 ? 2.35 : 0) : 2.55;
  stages.hero.scale.setScalar(narrow ? .82 : mobile ? .9 : 1);
  heroDock.visible = !mobile;
  heroDrone.userData.ringGroup.visible = !mobile;
  heroDrone.position.y = mobile ? (window.innerHeight < 800 ? 5.2 : 6.0) : 3.24;
  heroDock.position.y = 0;

  lineupDrones.forEach((d, i) => {
    const type = d.userData.type;
    const base = d.userData.meta.scale * (mobile ? .36 : .68);
    d.scale.setScalar(base);
    d.userData.baseScale = base;
    if (tablet) {
      const wide = window.innerWidth > 900;
      const sc = d.userData.meta.scale * (wide ? .62 : .55);
      const spread = wide ? 4.2 : 3.4;
      d.scale.setScalar(sc);
      d.userData.baseScale = sc;
      d.position.set(-spread + i * (spread * 2 / 3), .58 + [0, .1, -.02, .08][i], [.2, -.14, .1, -.16][i]);
    } else if (narrow) {
      d.position.set(-1.9 + i * 1.27, .58 + [0, .1, -.02, .08][i], [.15, -.1, .08, -.12][i]);
    } else {
      d.position.set(-5.85 + i * 3.9, d.userData.baseY, [.25, -.18, .12, -.25][i]);
    }
  });
  stages.lineup.position.y = mobile ? .35 : .15;

  Object.values(detailDrones).forEach((d) => {
    d.position.set(mobile ? 0 : 2.3, mobile ? 1.55 : .72, 0);
    d.userData.baseScale = d.userData.meta.scale * (mobile ? .9 : 1);
    d.scale.setScalar(d.userData.baseScale);
  });
  stages.detail.scale.setScalar(1);

  stages.docks.scale.setScalar(mobile ? (narrow ? .82 : .76) : 1);
  dock3.visible = !mobile;
  dock4.visible = true;
  dock3.position.set(-4.1, -.2, 0);
  dock4.position.set(mobile ? 0 : 4.1, -.2, 0);
  dock4Drones[0].visible = !mobile;
  dock4Drones[1].visible = true;
  dock4Drones[0].position.set(-4.1, 2.65, 0);
  dock4Drones[1].position.set(mobile ? 0 : 4.1, 2.72, 0);
  dock4Drones.forEach(d => { d.userData.baseScale = d.userData.meta.scale * .53; d.scale.setScalar(d.userData.baseScale); });

  missionMap.scale.setScalar(mobile ? (narrow ? .56 : .68) : .92);
  missionMap.position.y = -2.08;
}

function scenePreset(name) {
  const mobile = window.innerWidth <= 1400;
  if (mobile) {
    const presets = {
      hero: { dist: 16.5, elev: .12, yaw: .18, fov: 35, tx: 0, ty: 1.5, tz: 0 },
      lineup: { dist: 24, elev: .12, yaw: .02, fov: 32, tx: 0, ty: .4, tz: 0 },
      models: { dist: 15, elev: .12, yaw: .3, fov: 35, tx: 0, ty: 2.55, tz: 0 },
      usage: { dist: 16.5, elev: .16, yaw: .35, fov: 35, tx: 0, ty: 1.4, tz: 0 },
      compare: { dist: 15, elev: .12, yaw: .22, fov: 35, tx: 0, ty: 1.3, tz: 0 },
      docks: { dist: 16.8, elev: .2, yaw: .02, fov: 36, tx: 0, ty: 2.55, tz: 0 },
      applications: { dist: 33, elev: .55, yaw: .04, fov: 36, tx: 0, ty: .2, tz: 0 },
      outro: { dist: 18, elev: .15, yaw: .32, fov: 35, tx: 0, ty: 1.5, tz: 0 }
    };
    if (window.innerWidth > 680) {
      presets.lineup = { dist: 21, elev: .12, yaw: .02, fov: 32, tx: 0, ty: 1.4, tz: 0 };
    }
    if (window.innerWidth > 900 && window.innerHeight < 900) {
      presets.models = { ...presets.models, ty: 3.85 };
    }
    return presets[name] || { dist: 16, elev: .14, yaw: .2, fov: 35, tx: 0, ty: 1.3, tz: 0 };
  }
  return {
    hero: { dist: 13.9, elev: .135, yaw: .24, fov: 34, tx: .25, ty: 1.55, tz: 0 },
    lineup: { dist: 21.5, elev: .17, yaw: .04, fov: 34, tx: 0, ty: -2.15, tz: 0 },
    models: { dist: 11.9, elev: .13, yaw: .33, fov: 34, tx: 0, ty: .95, tz: 0 },
    usage: { dist: 14.5, elev: .16, yaw: .38, fov: 35, tx: 0, ty: .65, tz: 0 },
    compare: { dist: 13, elev: .1, yaw: .2, fov: 35, tx: 0, ty: .55, tz: 0 },
    docks: { dist: 20.8, elev: .2, yaw: .03, fov: 34, tx: 0, ty: 2.25, tz: 0 },
    applications: { dist: 21.5, elev: .54, yaw: .04, fov: 38, tx: 0, ty: .2, tz: 0 },
    outro: { dist: 15.5, elev: .16, yaw: .35, fov: 34, tx: 0, ty: 1.55, tz: 0 }
  }[name] || { dist: 14, elev: .14, yaw: .24, fov: 34, tx: 0, ty: 1.3, tz: 0 };
}

function missionCameraTarget() {
  const scale = missionMap ? missionMap.scale.x : .92;
  const p = MISSION_POINTS[activeMission] || [0, 0, 0];
  return { x: p[0] * scale * .64, z: p[2] * scale * .64 };
}

function applyPreset(name, instant = false) {
  camTarget = scenePreset(name);
  if (name === 'missions') {
    const focus = missionCameraTarget();
    camTarget.tx = focus.x;
    camTarget.tz = focus.z;
  }
  if (instant) Object.assign(cam, camTarget);
}

function setActiveSection(id, force = false) {
  if (!force && id === activeSection) return;
  activeSection = id;
  const section = document.getElementById(id);
  if (!section) return;
  const sceneName = section.dataset.scene || 'hero';
  activeScene = sceneName;
  document.body.dataset.section = id;
  let stageKey = {
    hero: 'hero', outro: 'hero', lineup: 'lineup', models: 'detail', usage: 'none',
    compare: 'none', docks: 'docks', missions: 'missions'
  }[sceneName] || 'none';
  if (sceneName === 'missions' && window.innerWidth <= 1400) stageKey = 'none';

  Object.entries(stages).forEach(([key, group]) => { group.visible = key === stageKey; });
  activeStageKey = stageKey;

  if (stageKey === 'hero') {
    setDockOpen(heroDock, id === 'outro' ? .55 : 1);
    heroDrone.visible = true;
  }
  if (stageKey === 'docks') {
    setDockOpen(dock3, 1);
    setDockOpen(dock4, 1);
  }
  if (stageKey === 'missions') {
    missionMap.userData.setActive(activeMission, MISSION_COLORS[activeMission]);
  }
  hotspotsLayer.classList.toggle('is-visible', sceneName === 'models');
  orbitYaw = 0; orbitPitch = 0;
  applyPreset(sceneName);

  $$('.section-rail a').forEach(a => a.classList.toggle('is-active', a.dataset.rail === id));
  $$('.topnav a').forEach(a => a.classList.toggle('is-active', a.dataset.nav === id));
}

function applyModel(type, animate = true) {
  if (!DRONE_META[type]) return;
  selectedType = type;
  document.body.dataset.model = type;
  const meta = DRONE_META[type];

  $$('[data-model-tab]').forEach((btn) => {
    const on = btn.dataset.modelTab === type;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  $$('.model-panel').forEach((panel) => {
    const on = panel.id === `panel-${type}`;
    panel.hidden = !on;
    panel.classList.toggle('is-active', on);
  });

  Object.entries(detailDrones).forEach(([key, drone]) => {
    const on = key === type;
    if (on && !drone.visible) {
      drone.scale.setScalar(drone.userData.baseScale * (animate ? .82 : 1));
    }
    drone.visible = on;
  });
  selectedDetail = detailDrones[type];
  if (selectedDetail) {
    selectedDetail.userData.baseScale = selectedDetail.userData.meta.scale * (window.innerWidth <= 1400 ? .9 : 1);
    if (!animate) selectedDetail.scale.setScalar(selectedDetail.userData.baseScale);
  }

  const color = new THREE.Color(meta.accent);
  if (stageLight) stageLight.color.copy(color);
  const hotspotText = $$('.hotspot');
  hotspotText.forEach((btn) => {
    const pair = meta.hotspots[btn.dataset.hotspot];
    if (!pair) return;
    btn.querySelector('b').textContent = pair[0];
    btn.querySelector('small').textContent = pair[1];
  });
}

function updateHotspots() {
  if (activeScene !== 'models' || !selectedDetail) return;
  const w = window.innerWidth, h = window.innerHeight;
  const anchors = selectedDetail.userData.anchors;
  selectedDetail.updateWorldMatrix(true, false);
  $$('.hotspot').forEach((btn) => {
    const key = btn.dataset.hotspot;
    const anchor = anchors[key];
    if (!anchor) return;
    const pos = selectedDetail.localToWorld(anchor.clone()).project(camera);
    const x = (pos.x * .5 + .5) * w;
    const y = (-pos.y * .5 + .5) * h;
    const on = pos.z < 1 && x > 30 && x < w - 30 && y > 90 && y < h - 50;
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.classList.toggle('is-on', on);
  });
}

function onScroll() {
  const scrolled = window.scrollY;
  const bar = $('#scrollBar');
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  if (bar) bar.style.transform = `scaleX(${clamp(scrolled / max, 0, 1)})`;
  document.body.classList.toggle('is-scrolled', scrolled > 32);

  const sections = $$('[data-scene]');
  const probe = scrolled + window.innerHeight * .44;
  let current = sections[0];
  for (const s of sections) {
    const top = s.getBoundingClientRect().top + scrolled;
    if (top <= probe) current = s;
  }
  if (current) setActiveSection(current.id);
}

function onResize() {
  if (!renderer) return;
  const mobile = window.innerWidth <= 900;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.7 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  layoutStages();
  setActiveSection(activeSection, true);
  applyPreset(activeScene, true);
  onScroll();
}

function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('a,button,table,input,textarea,select,.compare-scroll')) return;
  dragging = true;
  dragMoved = false;
  lastPX = e.clientX;
  lastPY = e.clientY;
}
function onPointerMove(e) {
  pointerX = (e.clientX / window.innerWidth) * 2 - 1;
  pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  if (!dragging) return;
  const dx = e.clientX - lastPX;
  const dy = e.clientY - lastPY;
  if (Math.abs(dx) + Math.abs(dy) > 2) {
    dragMoved = true;
    userInteracted = true;
    document.body.classList.add('is-dragging');
  }
  lastPX = e.clientX;
  lastPY = e.clientY;
  orbitYaw -= dx * .0048;
  orbitPitch += dy * .0028;
  orbitYaw = clamp(orbitYaw, -1.1, 1.1);
  orbitPitch = clamp(orbitPitch, -.22, .3);
}
function onPointerUp() {
  dragging = false;
  setTimeout(() => {
    if (!dragging) document.body.classList.remove('is-dragging');
  }, 30);
  dragMoved = false;
}

function bindUI() {
  const menuToggle = $('#menuToggle');
  const topnav = $('.topnav');
  menuToggle?.addEventListener('click', () => {
    const open = topnav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  });
  $$('.topnav a').forEach((a) => a.addEventListener('click', () => {
    topnav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  }));

  const modelTabs = $$('[data-model-tab]');
  modelTabs.forEach((btn, i) => {
    btn.addEventListener('click', () => applyModel(btn.dataset.modelTab));
    btn.addEventListener('keydown', (e) => {
      const key = e.key;
      let next = null;
      if (key === 'ArrowRight' || key === 'ArrowDown') next = (i + 1) % modelTabs.length;
      if (key === 'ArrowLeft' || key === 'ArrowUp') next = (i - 1 + modelTabs.length) % modelTabs.length;
      if (next !== null) { e.preventDefault(); modelTabs[next].focus(); modelTabs[next].click(); }
    });
  });

  $$('[data-select-model]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const type = el.dataset.selectModel;
      if (!DRONE_META[type]) return;
      e.preventDefault();
      applyModel(type);
      const target = $('#models');
      if (target) target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });

  $$('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      $$('[data-filter]').forEach(b => b.classList.toggle('is-active', b === btn));
      comparePanel.dataset.filter = filter === 'all' ? '' : filter;
      if (filter === 'all') delete comparePanel.dataset.filter;
      filterHint.textContent = filter === 'portable' ? '便携系列 / 02 款 · 4T / 4E' : filter === 'dock' ? '机场系列 / 02 款 · 4TD / 5TD' : '04 款机型 / 数据来自官方公开参数';
    });
  });

  $$('.mission-card').forEach((card) => {
    card.addEventListener('click', () => activateMission(Number(card.dataset.mission)));
  });

  const railLinks = $$('.section-rail a');
  railLinks.forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && topnav.classList.contains('is-open')) {
      topnav.classList.remove('is-open');
      menuToggle?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      menuToggle?.focus();
    }
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => revealObserver.observe(el));
}

function activateMission(index) {
  const cards = $$('.mission-card');
  const card = cards[index];
  if (!card) return;
  activeMission = index;
  cards.forEach((c, i) => {
    c.classList.toggle('is-active', i === index);
    c.setAttribute('aria-pressed', String(i === index));
  });
  $('#missionIndex').textContent = `${String(index + 1).padStart(2, '0')} / 06`;
  $('#missionName').textContent = card.dataset.name;
  $('#missionDesc').textContent = card.dataset.desc;
  $('#missionModel').textContent = card.dataset.model;
  const tags = (card.dataset.tags || '').split('|').filter(Boolean);
  const tagsEl = $('#missionTags');
  tagsEl.innerHTML = tags.map(t => `<span>${t}</span>`).join('');
  if (missionMap) missionMap.userData.setActive(index, MISSION_COLORS[index] || 0xff6b1a);
  if (stageLight) stageLight.color.set(MISSION_COLORS[index] || 0xff6b1a);
  if (activeScene === 'missions') {
    const focus = missionCameraTarget();
    camTarget.tx = focus.x;
    camTarget.tz = focus.z;
  }
}

function updateCamera(dt, t) {
  cam.dist = damp(cam.dist, camTarget.dist, 2.4, dt);
  cam.elev = damp(cam.elev, camTarget.elev, 2.4, dt);
  cam.yaw = damp(cam.yaw, camTarget.yaw, 2.4, dt);
  cam.fov = damp(cam.fov, camTarget.fov, 2.4, dt);
  cam.tx = damp(cam.tx, camTarget.tx, 2.4, dt);
  cam.ty = damp(cam.ty, camTarget.ty, 2.4, dt);
  cam.tz = damp(cam.tz, camTarget.tz, 2.4, dt);

  const idle = (!reducedMotion && !userInteracted && (activeScene === 'hero' || activeScene === 'outro')) ? Math.sin(t * .12) * .045 : 0;
  const parallaxYaw = (!reducedMotion && (activeScene === 'hero' || activeScene === 'outro')) ? pointerX * .025 : 0;
  const parallaxPitch = (!reducedMotion && (activeScene === 'hero' || activeScene === 'outro')) ? pointerY * .012 : 0;
  const yaw = cam.yaw + orbitYaw + idle + parallaxYaw;
  const elev = clamp(cam.elev + orbitPitch - parallaxPitch, .02, 1.12);
  const cos = Math.cos(elev);
  camera.position.set(
    cam.tx + Math.sin(yaw) * cos * cam.dist,
    cam.ty + Math.sin(elev) * cam.dist,
    cam.tz + Math.cos(yaw) * cos * cam.dist
  );
  camera.lookAt(cam.tx, cam.ty, cam.tz);
  if (Math.abs(camera.fov - cam.fov) > .01) {
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
  }
}

function animateDrones(dt, t) {
  const spin = reducedMotion ? .15 : 1;
  const bob = reducedMotion ? 0 : 1;

  // hero drone
  if (stages.hero.visible) {
    const heroBaseY = window.innerWidth <= 1400 ? (window.innerHeight < 800 ? 5.2 : 6.0) : 3.24;
    heroDrone.position.y = heroBaseY + Math.sin(t * .72) * .055 * bob;
    heroDrone.rotation.y = .15 + Math.sin(t * .17) * .12;
    heroDrone.rotation.z = Math.sin(t * .5) * .008;
    for (const r of heroDrone.userData.rotors) r.rotation.y += dt * 20 * spin * r.userData.dir;
    heroDrone.userData.ringGroup.rotation.y = t * .12;
  }

  // line up
  if (stages.lineup.visible) {
    lineupDrones.forEach((d, i) => {
      d.position.y = d.userData.baseY + Math.sin(t * .55 + d.userData.phase) * .055 * bob;
      d.rotation.z = Math.sin(t * .42 + i) * .01;
      for (const r of d.userData.rotors) r.rotation.y += dt * 15 * spin * r.userData.dir;
    });
  }

  // dock drones
  if (stages.docks.visible) {
    dock4Drones.forEach((d, i) => {
      d.position.y = (i === 0 ? 2.65 : 2.72) + Math.sin(t * .6 + i * 1.4) * .06 * bob;
      d.rotation.y = (i === 0 ? .25 : -.2) + Math.sin(t * .15 + i) * .1;
      for (const r of d.userData.rotors) r.rotation.y += dt * 16 * spin * r.userData.dir;
    });
  }

  // selected detail drone
  if (stages.detail.visible && selectedDetail) {
    const base = selectedDetail.userData.baseScale;
    const s = selectedDetail.scale.x;
    selectedDetail.scale.setScalar(damp(s, base, 9, dt));
    selectedDetail.position.y = (window.innerWidth <= 1400 ? 1.55 : .72) + Math.sin(t * .65) * .045 * bob;
    selectedDetail.rotation.y = Math.sin(t * .16) * .055;
    selectedDetail.rotation.z = Math.sin(t * .38) * .006 * bob;
    selectedDetail.userData.ringGroup.rotation.y = t * .07;
    for (const r of selectedDetail.userData.rotors) r.rotation.y += dt * 9 * spin * r.userData.dir;
    for (const r of selectedDetail.userData.rotors) {
      if (r.userData.disc) r.userData.disc.material.opacity = .018 + .012 * Math.sin(t * 2 + r.userData.dir);
    }
  }

  // dock doors / beams
  updateDock(heroDock, dt, t);
  updateDock(dock3, dt, t);
  updateDock(dock4, dt, t);
}

function animate() {
  if (!webglOk) return;
  requestAnimationFrame(animate);
  if (!ready) return;
  const dt = Math.min(clock.getDelta(), .05);
  const t = clock.elapsedTime;

  updateCamera(dt, t);
  animateDrones(dt, t);
  if (stages.missions.visible) missionMap.userData.update(t);

  if (scene?.userData.dust) {
    scene.userData.dust.rotation.y = t * .0035;
    scene.userData.dust.position.y = Math.sin(t * .18) * .08;
  }

  if (stageLight) {
    stageLight.intensity = activeScene === 'models' ? 20 + Math.sin(t * 1.1) * 1.6 : 22;
  }

  updateHotspots();
  renderer.render(scene, camera);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { updateLoader(8); init(); });
} else {
  updateLoader(8);
  init();
}
