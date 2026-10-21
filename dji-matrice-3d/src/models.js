import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;

export const DRONE_META = {
  '4T': {
    type: '4T', name: 'MATRICE 4T', accent: 0xff6b1a, scale: 1,
    camera: 'thermal', rugged: false,
    hotspots: {
      gimbal: ['三摄影像系统', '24–168 mm / 红外'],
      rtk: ['RTK 定位', '厘米级精度'],
      sense: ['全向感知', '视觉 + 红外']
    }
  },
  '4E': {
    type: '4E', name: 'MATRICE 4E', accent: 0x5ec8ff, scale: 1,
    camera: 'mapping', rugged: false,
    hotspots: {
      gimbal: ['4/3 测绘相机', '机械快门 / 2000 万'],
      rtk: ['RTK 定位', '厘米级精度'],
      sense: ['全向感知', '视觉 + 红外']
    }
  },
  '4TD': {
    type: '4TD', name: 'MATRICE 4TD', accent: 0x43e2b2, scale: 1.045,
    camera: 'thermal', rugged: true,
    hotspots: {
      gimbal: ['三摄 + 热成像', '640×512 / 1800 m 激光'],
      rtk: ['集成 RTK', '机场 3 自动起降'],
      sense: ['全向感知', 'IP55 / 抗风 12 m/s']
    }
  },
  '5TD': {
    type: '5TD', name: 'MATRICE 5TD', accent: 0xff5540, scale: 1.1,
    camera: 'thermal', rugged: true,
    hotspots: {
      gimbal: ['1280×1024 热成像', '3000 m 激光 / 252 mm'],
      rtk: ['集成 RTK', '机场 4 自动换电'],
      sense: ['全向感知', '毫米波 + 激光雷达']
    }
  }
};

const shared = {};
function getShared() {
  if (shared.ready) return shared;
  shared.ready = true;
  shared.glow = makeGlowTexture();
  shared.dot = makeDotTexture();
  shared.noise = makeNoiseTexture();
  return shared;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.12, 'rgba(255,255,255,.92)');
  g.addColorStop(.34, 'rgba(255,255,255,.32)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.4, 'rgba(255,255,255,.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNoiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  g.addColorStop(0, 'rgba(18,45,58,.8)');
  g.addColorStop(.4, 'rgba(9,25,34,.42)');
  g.addColorStop(1, 'rgba(2,6,9,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTextTexture(text, opts = {}) {
  const { w = 1024, h = 128, color = '#c9d7de', font = '600 54px Space Mono, monospace', align = 'center', sub = '' } = opts;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, align === 'center' ? w / 2 : 20, sub ? h * .44 : h / 2);
  if (sub) {
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '400 22px Space Mono, monospace';
    ctx.fillText(sub, align === 'center' ? w / 2 : 20, h * .74);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function glowSprite(color, size, opacity = .8) {
  const tex = getShared().glow;
  const mat = new THREE.SpriteMaterial({
    map: tex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

function rounded(w, h, d, r, mat, seg = 4) {
  const geo = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2));
  return new THREE.Mesh(geo, mat);
}

function cylinder(r1, r2, h, mat, seg = 24) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
}

function beamBetween(a, b, width, height, mat, radius = .04) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const mesh = rounded(len, height, width, radius, mat, 3);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  return mesh;
}

function createMaterials(meta) {
  const accent = new THREE.Color(meta.accent);
  const body = new THREE.MeshPhysicalMaterial({
    color: meta.rugged ? 0x6f787e : 0x858e94,
    metalness: .74, roughness: .34, clearcoat: .55, clearcoatRoughness: .42
  });
  const bodyLight = new THREE.MeshPhysicalMaterial({
    color: meta.rugged ? 0x899196 : 0x9aa2a7,
    metalness: .82, roughness: .26, clearcoat: .6, clearcoatRoughness: .32
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x171c20, metalness: .55, roughness: .53 });
  const black = new THREE.MeshStandardMaterial({ color: 0x080a0c, metalness: .25, roughness: .72 });
  const blade = new THREE.MeshStandardMaterial({ color: 0x4a5359, metalness: .45, roughness: .48 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0d0f, metalness: .05, roughness: .94 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 1.45, roughness: .35, metalness: .25
  });
  const accentDim = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: .38, roughness: .45, metalness: .3
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x02070b, metalness: .65, roughness: .06, clearcoat: 1, clearcoatRoughness: .05
  });
  const lensBlue = new THREE.MeshPhysicalMaterial({
    color: 0x071a2a, emissive: 0x0a2c46, emissiveIntensity: .5,
    metalness: .9, roughness: .05, clearcoat: 1
  });
  const lensRed = new THREE.MeshPhysicalMaterial({
    color: 0x260706, emissive: 0x4c0d05, emissiveIntensity: .75,
    metalness: .8, roughness: .08, clearcoat: 1
  });
  return { accent, body, bodyLight, dark, black, blade, rubber, accentMat, accentDim, glass, lensBlue, lensRed };
}

function addLandingGear(root, mats, meta) {
  const s = meta.rugged ? 1.04 : 1;
  const gear = new THREE.Group();
  for (const side of [-1, 1]) {
    const x = side * .56 * s;
    gear.add(beamBetween([side * .37 * s, -.12, .25], [x, -.58 * s, .18], .07, .07, mats.dark, .025));
    gear.add(beamBetween([side * .37 * s, -.12, -.24], [x, -.58 * s, -.18], .07, .07, mats.dark, .025));
    const skid = rounded(.09, .07, 1.02 * s, .03, mats.rubber);
    skid.position.set(x, -.63 * s, 0);
    gear.add(skid);
    const footF = rounded(.12, .05, .14, .02, mats.rubber);
    footF.position.set(x, -.67 * s, .38 * s); gear.add(footF);
    const footB = rounded(.12, .05, .14, .02, mats.rubber);
    footB.position.set(x, -.67 * s, -.38 * s); gear.add(footB);
  }
  root.add(gear);
}

function addCamera(root, mats, meta) {
  const isThermal = meta.camera === 'thermal';
  const gimbal = new THREE.Group();
  gimbal.position.set(0, -.245, .34);

  const mount = rounded(.3, .1, .2, .03, mats.dark);
  mount.position.y = .14; gimbal.add(mount);
  const yokeL = rounded(.055, .2, .2, .02, mats.dark);
  yokeL.position.set(-.18, .02, 0); gimbal.add(yokeL);
  const yokeR = yokeL.clone(); yokeR.position.x = .18; gimbal.add(yokeR);

  const head = rounded(.34, .27, .3, .07, mats.dark);
  head.position.set(0, -.05, .03); gimbal.add(head);
  const face = rounded(.3, .23, .04, .025, mats.black);
  face.position.set(0, -.05, .19); gimbal.add(face);

  const lensData = isThermal
    ? [
        { x: -.07, y: .025, r: .083, kind: 'blue' },
        { x: .085, y: .045, r: .048, kind: 'blue' },
        { x: .09, y: -.06, r: .042, kind: 'blue' },
        { x: -.105, y: -.075, r: .055, kind: 'red' }
      ]
    : [
        { x: -.045, y: .015, r: .102, kind: 'blue' },
        { x: .105, y: .052, r: .05, kind: 'blue' },
        { x: .105, y: -.058, r: .045, kind: 'blue' }
      ];

  for (const l of lensData) {
    const barrel = cylinder(l.r * 1.18, l.r * 1.18, .055, mats.black, 28);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(l.x, l.y, .225);
    gimbal.add(barrel);
    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(l.r * .92, 28),
      l.kind === 'red' ? mats.lensRed : mats.lensBlue
    );
    glass.position.set(l.x, l.y, .256);
    gimbal.add(glass);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(l.r * 1.02, .008, 6, 28), mats.bodyLight);
    rim.position.set(l.x, l.y, .247);
    gimbal.add(rim);
  }

  if (isThermal) {
    const laser = cylinder(.021, .021, .04, mats.accentMat, 12);
    laser.rotation.x = Math.PI / 2;
    laser.position.set(.02, -.105, .245);
    gimbal.add(laser);
    const ir = rounded(.12, .045, .02, .01, mats.accentDim);
    ir.position.set(0, .115, .2); gimbal.add(ir);
  }

  for (const side of [-1, 1]) {
    const motor = cylinder(.042, .042, .055, mats.black, 18);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(side * .198, .01, .02);
    gimbal.add(motor);
  }
  const heat = rounded(.18, .02, .14, .01, mats.bodyLight);
  heat.position.set(0, -.195, .04); gimbal.add(heat);

  root.add(gimbal);
  return gimbal;
}

function addSideDecal(root, meta) {
  const tex = makeTextTexture(meta.name, { w: 1024, h: 128, color: '#d5e0e5', font: '500 52px Space Mono, monospace' });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(.68, .085), mat);
    plane.position.set(side * .595, .13, -.04);
    plane.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(plane);
  }
}

function addRtk(root, mats, meta) {
  const rtk = new THREE.Group();
  rtk.position.set(0, .285, .02);
  const base = cylinder(.12, .145, .045, mats.bodyLight, 32);
  base.position.y = .02; rtk.add(base);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(.105, 24, 12, 0, TAU, 0, Math.PI / 2),
    mats.bodyLight
  );
  dome.position.y = .04; rtk.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.115, .006, 6, 32), mats.accentDim);
  ring.rotation.x = Math.PI / 2; ring.position.y = .045; rtk.add(ring);
  root.add(rtk);
}

function addRuggedDetails(root, mats, meta) {
  if (!meta.rugged) return;
  const scale = meta.type === '5TD' ? 1.08 : 1;
  for (const side of [-1, 1]) {
    const bumper = rounded(.16, .12, .38, .04, mats.dark);
    bumper.position.set(side * .52 * scale, .01, .34 * scale);
    root.add(bumper);
    const bumper2 = bumper.clone();
    bumper2.position.z = -.32 * scale;
    root.add(bumper2);
  }
  const topPlate = rounded(.55, .035, .42, .015, mats.dark);
  topPlate.position.set(0, .315, -.06); root.add(topPlate);
  const caution = rounded(.18, .022, .03, .008, mats.accentMat);
  caution.position.set(0, .335, -.26); root.add(caution);
}

function addRotors(root, mats, meta) {
  const rotors = [];
  const discs = [];
  const sign = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  const x = 1.34;
  const z = 1.0;
  const propR = 1.08;
  sign.forEach(([sx, sz], i) => {
    const px = sx * x, pz = sz * z;
    const pod = cylinder(.19, .21, .12, mats.dark, 24);
    pod.position.set(px, .015, pz); root.add(pod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.19, .009, 6, 32), mats.accentDim);
    ring.rotation.x = Math.PI / 2; ring.position.set(px, .078, pz); root.add(ring);

    const motor = cylinder(.115, .135, .17, mats.dark, 24);
    motor.position.set(px, .14, pz); root.add(motor);
    const motorTop = cylinder(.1, .118, .055, mats.bodyLight, 24);
    motorTop.position.set(px, .245, pz); root.add(motorTop);

    const rotor = new THREE.Group();
    rotor.position.set(px, .285, pz);
    const hub = cylinder(.045, .055, .05, mats.dark, 16);
    hub.position.y = .015; rotor.add(hub);
    for (const side of [0, 1]) {
      const holder = new THREE.Group();
      holder.rotation.y = side * Math.PI;
      const bladeMesh = rounded(propR * .94, .02, .125, .05, mats.blade, 3);
      bladeMesh.position.x = .055 + propR * .47;
      bladeMesh.rotation.x = side ? -.12 : .12;
      holder.add(bladeMesh);
      const tip = rounded(.1, .02, .105, .03, mats.accentDim, 2);
      tip.position.set(propR * .95, .003, 0);
      bladeMesh.add(tip);
      rotor.add(holder);
    }
    const discMat = new THREE.MeshBasicMaterial({
      color: meta.accent, transparent: true, opacity: .055,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(propR, 64), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = .01;
    rotor.add(disc);
    rotor.userData.dir = i % 2 === 0 ? 1 : -1;
    rotor.userData.disc = disc;
    root.add(rotor);
    rotors.push(rotor);
    discs.push(disc);
  });
  return rotors;
}

export function createDrone(type) {
  const meta = DRONE_META[type] || DRONE_META['4T'];
  const mats = createMaterials(meta);
  const root = new THREE.Group();
  root.name = `drone-${type}`;
  root.scale.setScalar(meta.scale);

  const lower = rounded(1.16, .25, .82, .1, mats.body);
  lower.position.y = 0; root.add(lower);
  const upper = rounded(1.02, .16, .68, .07, mats.bodyLight);
  upper.position.y = .155; root.add(upper);

  const spine = rounded(.48, .055, .72, .025, mats.dark);
  spine.position.set(0, .265, -.01); root.add(spine);
  const spineAccent = rounded(.3, .018, .58, .008, mats.accentDim);
  spineAccent.position.set(0, .296, -.01); root.add(spineAccent);

  const nose = rounded(.62, .14, .18, .06, mats.bodyLight);
  nose.position.set(0, .06, .44); root.add(nose);
  const noseAccent = rounded(.58, .018, .015, .006, mats.accentMat);
  noseAccent.position.set(0, .092, .53); root.add(noseAccent);
  const noseBlack = rounded(.36, .07, .028, .015, mats.black);
  noseBlack.position.set(0, .01, .535); root.add(noseBlack);

  for (const side of [-1, 1]) {
    const sensor = cylinder(.035, .035, .02, mats.glass, 18);
    sensor.rotation.x = Math.PI / 2;
    sensor.position.set(side * .39, .06, .53);
    root.add(sensor);
    const led = new THREE.Mesh(new THREE.SphereGeometry(.012, 10, 8), mats.accentMat);
    led.position.set(side * .47, .025, .52); root.add(led);
  }

  // arms
  const armPositions = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const [sx, sz] of armPositions) {
    const start = [sx * .34, .015, sz * .22];
    const end = [sx * 1.33, .03, sz * 1.0];
    const arm = beamBetween(start, end, .16, .13, mats.body, .06);
    root.add(arm);
    const strip = beamBetween([sx * .5, .09, sz * .36], [sx * 1.25, .1, sz * .95], .026, .012, mats.accentDim, .006);
    root.add(strip);
    if (meta.rugged) {
      const guard = beamBetween([sx * .55, -.045, sz * .42], [sx * 1.23, -.045, sz * .94], .1, .025, mats.dark, .02);
      root.add(guard);
    }
  }

  // battery / belly
  const belly = rounded(.64, .16, .5, .06, mats.dark);
  belly.position.set(0, -.16, -.02); root.add(belly);
  const batteryLine = rounded(.44, .02, .03, .008, mats.accentDim);
  batteryLine.position.set(0, -.235, .17); root.add(batteryLine);

  // rear vents
  for (let i = 0; i < 5; i++) {
    const vent = rounded(.34, .012, .018, .005, mats.black);
    vent.position.set(0, .04 - i * .035, -.425);
    root.add(vent);
  }

  addLandingGear(root, mats, meta);
  addCamera(root, mats, meta);
  addRtk(root, mats, meta);
  addRuggedDetails(root, mats, meta);
  addSideDecal(root, meta);

  const rotors = addRotors(root, mats, meta);

  const ringGroup = new THREE.Group();
  ringGroup.position.y = -.78;
  const ringMat = new THREE.MeshBasicMaterial({
    color: meta.accent, transparent: true, opacity: .16,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.12, 2.155, 128), ringMat);
  ring.rotation.x = -Math.PI / 2; ringGroup.add(ring);
  const ring2Mat = ringMat.clone(); ring2Mat.opacity = .07;
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(2.42, 2.44, 128), ring2Mat);
  ring2.rotation.x = -Math.PI / 2; ringGroup.add(ring2);
  for (let i = 0; i < 4; i++) {
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(.16, .012), new THREE.MeshBasicMaterial({
      color: meta.accent, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false
    }));
    const a = i * Math.PI / 2 + Math.PI / 4;
    tick.position.set(Math.cos(a) * 2.28, .001, Math.sin(a) * 2.28);
    tick.rotation.x = -Math.PI / 2;
    tick.rotation.z = -a;
    ringGroup.add(tick);
  }
  root.add(ringGroup);

  const glow = glowSprite(meta.accent, 1.1, .24);
  glow.position.set(0, -.2, .32);
  root.add(glow);

  const anchors = {
    gimbal: new THREE.Vector3(0, -.42, .62),
    rtk: new THREE.Vector3(0, .43, .02),
    sense: new THREE.Vector3(1.36, .1, .95)
  };

  root.userData = {
    type, meta, anchors, rotors, ringGroup,
    accent: new THREE.Color(meta.accent),
    spin: 1
  };
  return root;
}

/* ------------------------------------------------------------------ */
/* DOCK                                                                */
/* ------------------------------------------------------------------ */

function makePadTexture(gen, accent) {
  const w = 768, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a1014';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * .55);
  g.addColorStop(0, 'rgba(35,58,70,.55)');
  g.addColorStop(.55, 'rgba(14,27,35,.5)');
  g.addColorStop(1, 'rgba(4,8,11,.9)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(171,194,206,.24)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.strokeStyle = 'rgba(171,194,206,.12)';
  ctx.strokeRect(40, 40, w - 80, h - 80);

  const ac = '#' + new THREE.Color(accent).getHexString();
  ctx.strokeStyle = ac;
  ctx.globalAlpha = .55;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 138, 0, TAU); ctx.stroke();
  ctx.globalAlpha = .18;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 172, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 108, 0, TAU); ctx.stroke();

  ctx.globalAlpha = .9;
  ctx.fillStyle = '#dce6ea';
  ctx.font = '700 150px Space Grotesk, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('H', w / 2, h / 2 - 4);

  ctx.globalAlpha = .55;
  ctx.fillStyle = ac;
  ctx.font = '500 26px Space Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`DJI DOCK ${gen}`, 48, h - 64);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(195,211,219,.55)';
  ctx.font = '400 18px Space Mono, monospace';
  ctx.fillText('AUTOMATED LANDING PAD', w - 48, h - 64);

  // corner brackets
  ctx.strokeStyle = ac; ctx.globalAlpha = .65; ctx.lineWidth = 4;
  for (const [x, y, sx, sy] of [[46, 46, 1, 1], [w - 46, 46, -1, 1], [46, h - 46, 1, -1], [w - 46, h - 46, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + sx * 34, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 34); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeDockLabel(gen) {
  const c = document.createElement('canvas');
  c.width = 768; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(208,222,229,.9)';
  ctx.font = '600 56px Space Mono, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`DJI DOCK ${gen}`, 18, 62);
  ctx.fillStyle = 'rgba(150,174,187,.66)';
  ctx.font = '400 22px Space Mono, monospace';
  ctx.fillText('AUTOMATED DRONE PLATFORM', 20, 108);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createBeamTexture() {
  return null;
}

export function createDock(gen = 3) {
  const meta = {
    3: { accent: 0x43e2b2, scale: 1, name: 'DOCK 3' },
    4: { accent: 0xff6b1a, scale: 1.08, name: 'DOCK 4' }
  }[gen];
  const accent = new THREE.Color(meta.accent);
  const root = new THREE.Group();
  root.scale.setScalar(meta.scale);
  root.name = `dock-${gen}`;

  const shell = new THREE.MeshPhysicalMaterial({ color: 0x7e878c, metalness: .78, roughness: .3, clearcoat: .5, clearcoatRoughness: .4 });
  const shellDark = new THREE.MeshStandardMaterial({ color: 0x1a2025, metalness: .55, roughness: .55 });
  const black = new THREE.MeshStandardMaterial({ color: 0x090b0d, metalness: .2, roughness: .8 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0d0e, roughness: .95 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4, roughness: .35 });
  const accentDim = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .4, roughness: .5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xd6e1e6, metalness: .4, roughness: .4 });

  // lower chassis / feet
  const skid = rounded(5.28, .2, 3.78, .08, rubber);
  skid.position.y = -.56; root.add(skid);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const foot = rounded(.38, .14, .38, .06, black);
    foot.position.set(sx * 2.25, -.67, sz * 1.55); root.add(foot);
  }

  const hull = rounded(5.4, .84, 3.9, .16, shell);
  hull.position.y = -.08; root.add(hull);
  const hullLower = rounded(5.3, .25, 3.78, .1, shellDark);
  hullLower.position.y = -.32; root.add(hullLower);

  // top rim
  const rim = rounded(5.46, .1, 3.96, .04, shellDark);
  rim.position.y = .38; root.add(rim);
  const inner = rounded(4.95, .06, 3.45, .03, black);
  inner.position.y = .43; root.add(inner);

  const padTex = makePadTexture(gen, meta.accent);
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(4.78, 3.28),
    new THREE.MeshStandardMaterial({ map: padTex, roughness: .8, metalness: .26, emissiveMap: padTex, emissive: 0xffffff, emissiveIntensity: .055 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = .465;
  root.add(pad);

  // LED strips around pad
  const ledMats = [];
  for (const side of [-1, 1]) {
    const mat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.1, roughness: .3 });
    ledMats.push(mat);
    const led = rounded(4.5, .016, .025, .007, mat);
    led.position.set(0, .475, side * 1.68); root.add(led);
    const led2 = rounded(.025, .016, 3.1, .007, mat);
    led2.position.set(side * 2.3, .475, 0); root.add(led2);
  }

  // doors
  const doorL = new THREE.Group();
  const doorR = new THREE.Group();
  const doorW = 2.66, doorD = 3.62;
  doorL.position.set(-2.7, .5, 0);
  doorR.position.set(2.7, .5, 0);
  for (const [pivot, side] of [[doorL, 1], [doorR, -1]]) {
    const panel = rounded(doorW, .1, doorD, .04, shellDark);
    panel.position.set(side * doorW / 2, 0, 0);
    pivot.add(panel);
    const top = rounded(doorW - .08, .035, doorD - .08, .015, shell);
    top.position.set(side * doorW / 2, .065, 0);
    pivot.add(top);
    for (let i = 0; i < 3; i++) {
      const seam = rounded(doorW - .5, .012, .022, .005, shellDark);
      seam.position.set(side * doorW / 2, .088, -.9 + i * .9);
      pivot.add(seam);
    }
    const edge = rounded(.025, .02, doorD - .18, .008, accentDim);
    edge.position.set(side * .06, .087, 0);
    pivot.add(edge);
    const hinge = cylinder(.052, .052, doorD - .12, black, 16);
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(0, -.02, 0);
    pivot.add(hinge);
    root.add(pivot);
  }

  // front console / label / status
  const console = rounded(2.5, .4, .08, .03, shellDark);
  console.position.set(0, -.02, 1.985); root.add(console);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, .34),
    new THREE.MeshBasicMaterial({ map: makeDockLabel(gen), transparent: true, depthWrite: false })
  );
  label.position.set(-.22, -.01, 2.032); root.add(label);
  const statusMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2, roughness: .25 });
  const status = rounded(1.3, .018, .02, .006, statusMat);
  status.position.set(.55, .14, 2.035); root.add(status);
  const statusGlow = glowSprite(meta.accent, .55, .5);
  statusGlow.position.set(.55, .15, 2.06); root.add(statusGlow);

  // side vents / battery bays
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const vent = rounded(.025, .038, .9, .008, black);
      vent.position.set(side * 2.705, -.03 - i * .055, -.35);
      root.add(vent);
    }
    const handle = rounded(.06, .1, .9, .02, shellDark);
    handle.position.set(side * 2.72, .2, .9); root.add(handle);
  }
  if (gen === 4) {
    for (let i = 0; i < 3; i++) {
      const bay = rounded(.06, .36, .52, .025, black);
      bay.position.set(2.715, -.03, -.72 + i * .66); root.add(bay);
      const led = new THREE.Mesh(new THREE.SphereGeometry(.016, 10, 8), accentMat);
      led.position.set(2.748, .11, -.72 + i * .66); root.add(led);
    }
  }

  // weather mast
  const mast = new THREE.Group();
  mast.position.set(-2.05, 0, -1.55);
  const pole = cylinder(.035, .045, 1.45, shellDark, 12);
  pole.position.y = .9; mast.add(pole);
  const cross = rounded(.82, .035, .035, .01, shellDark);
  cross.position.y = 1.58; mast.add(cross);
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xc6d1d6, metalness: .3, roughness: .6 });
  for (const x of [-.42, 0, .42]) {
    const arm = rounded(.02, .02, .02, .005, shellDark);
    arm.position.set(x, 1.58, 0); mast.add(arm);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 8, 0, TAU, 0, Math.PI * .7), cupMat);
    cup.position.set(x, 1.66, 0); mast.add(cup);
  }
  const rain = cylinder(.1, .12, .16, cupMat, 16);
  rain.position.y = 1.34; mast.add(rain);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), statusMat);
  beacon.position.y = 1.74; mast.add(beacon);
  const beaconGlow = glowSprite(meta.accent, .32, .55);
  beaconGlow.position.y = 1.74; mast.add(beaconGlow);
  root.add(mast);

  // antenna
  const antenna = new THREE.Group();
  antenna.position.set(2.15, 0, -1.58);
  for (const [x, z, h, tilt] of [[-.12, 0, 1.15, .08], [.1, .06, .95, -.06]]) {
    const rod = cylinder(.012, .018, h, black, 8);
    rod.position.set(x, h / 2 + .25, z);
    rod.rotation.z = tilt;
    antenna.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6), accentDim);
    tip.position.set(x + tilt * h / 2, h + .24, z); antenna.add(tip);
  }
  root.add(antenna);

  // dock 4 O4 ground station
  if (gen === 4) {
    const o4 = new THREE.Group();
    o4.position.set(3.18, -.02, 1.22);
    const body = rounded(.34, .5, .24, .05, shellDark);
    body.position.y = .28; o4.add(body);
    const strip = rounded(.2, .015, .012, .004, accentMat);
    strip.position.set(0, .4, .126); o4.add(strip);
    const pole = cylinder(.018, .022, .95, black, 8);
    pole.position.y = .88; o4.add(pole);
    const head = rounded(.3, .035, .08, .01, shellDark);
    head.position.y = 1.35; o4.add(head);
    o4.rotation.y = -.3;
    root.add(o4);
  }

  // holographic containment beam
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: accent }, uOpacity: { value: .12 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
      void main(){ float a=smoothstep(0.0,0.12,vUv.y)*(1.0-smoothstep(0.72,1.0,vUv.y));
      a*=0.7+0.3*sin(vUv.y*46.0-uTime*2.0); gl_FragColor=vec4(uColor,a*uOpacity); }`
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 2.8, 64, 1, true), beamMat);
  beam.position.y = 1.85;
  root.add(beam);

  const ringMat = new THREE.MeshBasicMaterial({ color: meta.accent, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.14, 128), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -.6;
  root.add(ring);

  const open = gen === 4 ? 0 : 0;
  root.userData = {
    gen, name: meta.name, accent: new THREE.Color(meta.accent),
    doorL, doorR, beam, beamMat, ring, ledMats, statusMat,
    open, target: open, openSpeed: 2.2
  };
  return root;
}

export function setDockOpen(dock, value) {
  dock.userData.target = value;
}
export function updateDock(dock, dt, t) {
  const u = dock.userData;
  u.open += (u.target - u.open) * Math.min(1, dt * u.openSpeed);
  const a = u.open * 1.08;
  u.doorL.rotation.z = a;
  u.doorR.rotation.z = -a;
  const glow = .02 + u.open * .16;
  u.beamMat.uniforms.uOpacity.value = glow;
  u.beamMat.uniforms.uTime.value = t;
  u.beam.visible = u.open > .03;
  if (u.ring) {
    u.ring.rotation.z = t * .06;
    u.ring.material.opacity = .08 + u.open * .11;
  }
  for (const m of u.ledMats) m.emissiveIntensity = .75 + .55 * (0.5 + 0.5 * Math.sin(t * 1.7));
  u.statusMat.emissiveIntensity = 1.5 + Math.sin(t * 2.1) * .5;
}

/* ------------------------------------------------------------------ */
/* MISSION MAP                                                         */
/* ------------------------------------------------------------------ */

const MISSION_POINTS = [
  [-6.4, 0, -2.4], [4.9, 0, -3.2], [6.8, 0, 1.8],
  [1.2, 0, 4.4], [-4.8, 0, 3.2], [-.3, 0, .25]
];

function contourLine(radius, wobble, color, opacity) {
  const pts = [];
  for (let i = 0; i < 90; i++) {
    const a = i / 90 * TAU;
    const r = radius * (1 + Math.sin(a * 3 + 1.2) * wobble + Math.cos(a * 5 - .3) * wobble * .5);
    pts.push(new THREE.Vector3(Math.cos(a) * r, .012, Math.sin(a) * r * .72));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

export function createMissionMap() {
  const root = new THREE.Group();
  root.name = 'mission-map';

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x06131a, metalness: .38, roughness: .8, transparent: true, opacity: .94 });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0;
  base.receiveShadow = true;
  root.add(base);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(24, 16)),
    new THREE.LineBasicMaterial({ color: 0x1c5363, transparent: true, opacity: .55 })
  );
  border.rotation.x = -Math.PI / 2;
  border.position.y = .025;
  root.add(border);

  const grid = new THREE.GridHelper(24, 24, 0x1a5b6f, 0x0d2d39);
  grid.position.y = .035;
  grid.material.transparent = true;
  grid.material.opacity = .28;
  root.add(grid);

  root.add(contourLine(7.6, .07, 0x1a5263, .32));
  root.add(contourLine(5.2, .11, 0x184b5b, .3));
  root.add(contourLine(3.2, .15, 0x143e4b, .3));
  root.add(contourLine(9.5, .05, 0x123440, .2));

  const beacons = [];
  const accent = new THREE.Color(0xff6b1a);
  MISSION_POINTS.forEach((p, i) => {
    const g = new THREE.Group();
    g.position.set(p[0], 0, p[2]);

    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(.58, .63, 56),
      new THREE.MeshBasicMaterial({ color: 0x347d91, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false })
    );
    baseRing.rotation.x = -Math.PI / 2; baseRing.position.y = .06; g.add(baseRing);

    const outer = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.015, 56),
      new THREE.MeshBasicMaterial({ color: 0x286372, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false })
    );
    outer.rotation.x = -Math.PI / 2; outer.position.y = .05; g.add(outer);

    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x347d91) }, uOpacity: { value: .18 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
        void main(){ float a=smoothstep(0.0,0.18,vUv.y)*(1.0-smoothstep(0.62,1.0,vUv.y));
        a*=0.55+0.45*sin(vUv.y*40.0-uTime*1.8); gl_FragColor=vec4(uColor,a*uOpacity); }`
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.32, .42, 2.7, 32, 1, true), beamMat);
    beam.position.y = 1.5; g.add(beam);

    const markerMat = new THREE.MeshStandardMaterial({ color: 0x4da7ba, emissive: 0x1d6374, emissiveIntensity: .9, roughness: .3, metalness: .5 });
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(.16, 0), markerMat);
    marker.position.y = 2.88; g.add(marker);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(.28, .008, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0x347d91, transparent: true, opacity: .5, depthWrite: false })
    );
    halo.position.y = 2.88; g.add(halo);

    const numTex = makeTextTexture(String(i + 1).padStart(2, '0'), { w: 256, h: 128, color: '#d7e5ea', font: '600 64px Space Mono, monospace' });
    const num = new THREE.Sprite(new THREE.SpriteMaterial({ map: numTex, transparent: true, depthWrite: false, opacity: .85 }));
    num.scale.set(.9, .45, 1); num.position.y = 3.35; g.add(num);

    g.userData = { baseRing, outer, beamMat, markerMat, marker, halo, beam, index: i };
    root.add(g);
    beacons.push(g);
  });

  const curvePts = MISSION_POINTS.map(p => new THREE.Vector3(p[0], .55, p[2]));
  curvePts.push(curvePts[0].clone());
  const curve = new THREE.CatmullRomCurve3(curvePts, true, 'catmullrom', .25);
  const pathGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(240));
  const pathMat = new THREE.LineDashedMaterial({ color: 0x4a9aad, dashSize: .22, gapSize: .18, transparent: true, opacity: .65, depthWrite: false });
  const path = new THREE.Line(pathGeo, pathMat);
  path.computeLineDistances();
  root.add(path);

  const drone = createDrone('5TD');
  drone.scale.multiplyScalar(.17);
  drone.userData.ringGroup.visible = false;
  root.add(drone);

  root.userData = {
    beacons, curve, path, drone,
    active: 0,
    accent,
    update(t) {
      for (const b of beacons) {
        const u = b.userData;
        u.beamMat.uniforms.uTime.value = t;
        u.halo.rotation.z = t * .3;
        u.halo.rotation.x = Math.PI / 2;
        u.marker.rotation.y = t * .35;
      }
      const tt = (t * .018) % 1;
      const pos = curve.getPointAt(tt);
      const tan = curve.getTangentAt(tt);
      drone.position.copy(pos);
      drone.position.y = .7 + Math.sin(t * .7) * .06;
      drone.rotation.y = Math.atan2(tan.x, tan.z);
      drone.rotation.z = Math.sin(t * .6) * .035;
      for (const r of drone.userData.rotors) r.rotation.y += .24;
    },
    setActive(index, color = 0xff6b1a) {
      this.active = index;
      beacons.forEach((b, i) => {
        const u = b.userData;
        const on = i === index;
        const c = on ? new THREE.Color(color) : new THREE.Color(0x2c6674);
        u.baseRing.material.color.copy(c);
        u.baseRing.material.opacity = on ? .95 : .28;
        u.outer.material.color.copy(c);
        u.outer.material.opacity = on ? .5 : .13;
        u.beamMat.uniforms.uColor.value.copy(c);
        u.beamMat.uniforms.uOpacity.value = on ? .22 : .08;
        u.markerMat.color.copy(c);
        u.markerMat.emissive.copy(c);
        u.markerMat.emissiveIntensity = on ? 2.4 : .45;
        u.marker.scale.setScalar(on ? 1.5 : .9);
        u.halo.material.color.copy(c);
        u.halo.material.opacity = on ? .95 : .24;
        u.halo.scale.setScalar(on ? 1.5 : .9);
        u.beam.scale.set(on ? 1.0 : .8, 1, on ? 1.0 : .8);
      });
    }
  };
  root.userData.setActive(0, 0xff6b1a);
  return root;
}

export { MISSION_POINTS, glowSprite, getShared };
