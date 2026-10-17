import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Joystick, { HoldButton, isTouch, Vec } from './Joystick';
import { createCharacter3D, SKINS, SkinId, updateCharacterAnimation } from './Character3D';
import { getBlockMaterials } from './textures3D';
import { createGrassGeometry, createGrassMaterial, createSky } from './sky';

const WX = 48;
const WY = 26;
const WZ = 48;
const WATER = 5;

type BlockDef = { name: string; emoji: string; color: number };
const BLOCKS: Record<number, BlockDef> = {
  1: { name: 'Herbe', emoji: '🟩', color: 0x4caf50 },
  2: { name: 'Terre', emoji: '🟫', color: 0x7c4f28 },
  3: { name: 'Pierre', emoji: '⬜', color: 0x7d828a },
  4: { name: 'Bois', emoji: '🪵', color: 0x734b26 },
  5: { name: 'Feuilles', emoji: '🍃', color: 0x246e32 },
  6: { name: 'Sable', emoji: '🟨', color: 0xe5cf87 },
  7: { name: 'Planches', emoji: '🟧', color: 0xc49352 },
  8: { name: 'Diamant', emoji: '💎', color: 0x38f8ff },
  11: { name: 'Briques', emoji: '🧱', color: 0xb5483a },
  12: { name: 'Verre', emoji: '🪟', color: 0xa5f3fc },
  13: { name: 'Or', emoji: '🟡', color: 0xfacc15 },
};
const HOTBAR = [1, 2, 3, 4, 7, 11, 12, 8, 13];

const PRESETS = {
  day: { top: 0x2b6fd6, bottom: 0xcfe8ff, sun: 0xfff3c4, fog: 0xbcdcff, sunI: 2.2, hemi: 0.85, sunCol: 0xfff5e0, exp: 1.0 },
  sunset: { top: 0x3b3f8f, bottom: 0xffa25c, sun: 0xffcf8a, fog: 0xe8a07a, sunI: 1.5, hemi: 0.55, sunCol: 0xffb36b, exp: 1.05 },
  night: { top: 0x020617, bottom: 0x1e2a4a, sun: 0xbfd4ff, fog: 0x141c33, sunI: 0.45, hemi: 0.28, sunCol: 0x9db8ff, exp: 0.9 },
};

export default function Sandbox({ onExit, skinId = 'ranger' }: { onExit: () => void; skinId?: SkinId }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const touch = isTouch();
  const [sel, setSel] = useState(0);
  const [inv, setInv] = useState<Record<number, number>>({ 1: 30, 2: 30, 3: 30, 4: 20, 7: 40, 11: 30, 12: 20, 8: 10, 13: 10 });
  const [camMode, setCamMode] = useState<'third' | 'first'>('third');
  const [timePreset, setTimePreset] = useState<keyof typeof PRESETS>('day');
  const [hint, setHint] = useState('');
  const [locked, setLocked] = useState(false);

  const selRef = useRef(sel); selRef.current = sel;
  const invRef = useRef(inv); invRef.current = inv;
  const camModeRef = useRef(camMode); camModeRef.current = camMode;
  const presetRef = useRef(timePreset); presetRef.current = timePreset;
  const act = useRef({ move: { x: 0, y: 0 } as Vec, jump: false, mine: false, place: false, swing: 0 });

  useEffect(() => { if (!hint) return; const t = setTimeout(() => setHint(''), 2200); return () => clearTimeout(t); }, [hint]);

  useEffect(() => {
    const container = mountRef.current!;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xbcdcff, 25, 70);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ---------- Lights & sky
    const sunOffset = new THREE.Vector3(30, 45, 18);
    const sky = createSky(sunOffset);
    scene.add(sky.mesh);
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x5b4a2a, 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
    const sd = 22;
    Object.assign(sun.shadow.camera, { left: -sd, right: sd, top: sd, bottom: -sd, near: 1, far: 120 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    // Clouds (flat voxel clouds)
    const clouds = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(6 + (i % 4) * 3, 1.2, 4 + (i % 3) * 2), cloudMat);
      c.position.set(((i * 37) % 140) - 46, 34 + (i % 3), ((i * 53) % 140) - 46);
      clouds.add(c);
    }
    scene.add(clouds);

    // Water
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x1d8fd6, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.3 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(WX / 2, WATER + 0.82, WZ / 2);
    scene.add(water);
    // Sea floor
    const seabed = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xc9b27a, roughness: 1 }));
    seabed.rotation.x = -Math.PI / 2;
    seabed.position.set(WX / 2, 1, WZ / 2);
    scene.add(seabed);

    // ---------- Voxel data
    const voxels = new Uint8Array(WX * WY * WZ);
    const idx = (x: number, y: number, z: number) => x + z * WX + y * WX * WZ;
    const inB = (x: number, y: number, z: number) => x >= 0 && x < WX && y >= 0 && y < WY && z >= 0 && z < WZ;
    const get = (x: number, y: number, z: number) => (inB(x, y, z) ? voxels[idx(x, y, z)] : 0);
    const opaque = (x: number, y: number, z: number) => { const b = get(x, y, z); return b !== 0 && b !== 12 && b !== 5; };

    const s1 = Math.random() * 100, s2 = Math.random() * 100;
    const heightAt = (x: number, z: number) => {
      const dx = (x - WX / 2) / (WX / 2), dz = (z - WZ / 2) / (WZ / 2);
      const island = 1 - Math.min(1, Math.sqrt(dx * dx + dz * dz)) ** 2.2;
      const n = Math.sin(x * 0.13 + s1) * 2.2 + Math.cos(z * 0.11 + s2) * 2.2 + Math.sin((x + z) * 0.07 + s1) * 3 + Math.sin(x * 0.31 - z * 0.27) * 0.8;
      return Math.max(1, Math.min(WY - 9, Math.floor(2 + island * 10 + n * island)));
    };
    for (let x = 0; x < WX; x++) for (let z = 0; z < WZ; z++) {
      const h = heightAt(x, z);
      for (let y = 0; y <= h; y++) {
        let id = 3;
        const beach = h <= WATER + 1;
        if (y === h) id = beach ? 6 : 1;
        else if (y >= h - 2) id = beach ? 6 : 2;
        else if (y <= 4 && (x * 17 + z * 31 + y * 13) % 23 === 0) id = 8;
        else if (y <= 7 && (x * 23 + z * 11 + y * 7) % 19 === 0) id = 13;
        voxels[idx(x, y, z)] = id;
      }
    }
    // Trees
    for (let i = 0; i < 26; i++) {
      const tx = 4 + Math.floor(Math.random() * (WX - 8)), tz = 4 + Math.floor(Math.random() * (WZ - 8));
      const h = heightAt(tx, tz);
      if (get(tx, h, tz) !== 1) continue;
      const th = 4 + Math.floor(Math.random() * 2);
      for (let k = 1; k <= th; k++) voxels[idx(tx, h + k, tz)] = 4;
      for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) for (let ly = th - 1; ly <= th + 1; ly++) {
        const r = ly === th + 1 ? 1 : 2;
        if (Math.abs(lx) > r || Math.abs(lz) > r) continue;
        if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && Math.random() < 0.6) continue;
        if (inB(tx + lx, h + ly, tz + lz) && get(tx + lx, h + ly, tz + lz) === 0) voxels[idx(tx + lx, h + ly, tz + lz)] = 5;
      }
    }

    // ---------- Instanced rendering
    const blockGroup = new THREE.Group();
    const decoGroup = new THREE.Group();
    scene.add(blockGroup, decoGroup);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const grassGeo = createGrassGeometry();
    const grassMat = createGrassMaterial();
    const lookup = new Map<number, number[]>();
    const m4 = new THREE.Matrix4();

    const rebuild = () => {
      for (const c of [...blockGroup.children, ...decoGroup.children]) { (c as THREE.InstancedMesh).dispose(); }
      blockGroup.clear(); decoGroup.clear(); lookup.clear();
      const lists = new Map<number, number[]>();
      const grass: number[] = [];
      for (let y = 0; y < WY; y++) for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
        const i = idx(x, y, z); const b = voxels[i];
        if (!b) continue;
        if (opaque(x + 1, y, z) && opaque(x - 1, y, z) && opaque(x, y + 1, z) && opaque(x, y - 1, z) && opaque(x, y, z + 1) && opaque(x, y, z - 1)) continue;
        if (!lists.has(b)) lists.set(b, []);
        lists.get(b)!.push(i);
        if (b === 1 && get(x, y + 1, z) === 0 && ((x * 7 + z * 13) % 3 === 0)) grass.push(i);
      }
      for (const [b, list] of lists) {
        const mesh = new THREE.InstancedMesh(boxGeo, getBlockMaterials(b), list.length);
        list.forEach((i, n) => {
          const y = Math.floor(i / (WX * WZ)), r = i % (WX * WZ), z = Math.floor(r / WX), x = r % WX;
          m4.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
          mesh.setMatrixAt(n, m4);
        });
        mesh.castShadow = b !== 12;
        mesh.receiveShadow = true;
        mesh.userData.type = b;
        lookup.set(b, list);
        blockGroup.add(mesh);
      }
      if (grass.length) {
        const gm = new THREE.InstancedMesh(grassGeo, grassMat, grass.length);
        grass.forEach((i, n) => {
          const y = Math.floor(i / (WX * WZ)), r = i % (WX * WZ), z = Math.floor(r / WX), x = r % WX;
          m4.makeRotationY((x * 31 + z) % 6);
          m4.setPosition(x + 0.5 + (((x * 13) % 5) - 2) * 0.08, y + 1, z + 0.5 + (((z * 7) % 5) - 2) * 0.08);
          gm.setMatrixAt(n, m4);
        });
        gm.receiveShadow = true;
        decoGroup.add(gm);
      }
    };
    rebuild();

    const decode = (i: number) => { const y = Math.floor(i / (WX * WZ)), r = i % (WX * WZ); return { x: r % WX, y, z: Math.floor(r / WX) }; };

    // Selection outline
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 }));
    outline.visible = false;
    scene.add(outline);

    // ---------- Player
    const skinDef = SKINS.find((s) => s.id === skinId) || SKINS[3];
    const rig = createCharacter3D(skinDef, 'pickaxe');
    rig.root.scale.setScalar(0.82);
    rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    scene.add(rig.root);
    const pos = new THREE.Vector3(WX / 2 + 0.5, heightAt(WX / 2, WZ / 2) + 1.05, WZ / 2 + 0.5);
    const vel = new THREE.Vector3();
    let onGround = false, yaw = Math.PI * 0.75, pitch = -0.2, bodyYaw = yaw + Math.PI;
    let camDist = 5, curDist = 5;

    // Debris
    type Deb = { m: THREE.Mesh; v: THREE.Vector3; life: number };
    const debris: Deb[] = [];
    const debGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const spawnDebris = (x: number, y: number, z: number, b: number) => {
      const mat = new THREE.MeshStandardMaterial({ color: BLOCKS[b]?.color ?? 0xffffff });
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(debGeo, mat);
        m.position.set(x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.5 + (Math.random() - 0.5) * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6);
        m.castShadow = true;
        scene.add(m);
        debris.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.8 });
      }
    };

    // ---------- Targeting (always from screen center / crosshair)
    const ray = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    const getHit = () => {
      ray.setFromCamera(center, camera);
      ray.far = 6 + (camModeRef.current === 'third' ? curDist : 0);
      const hits = ray.intersectObjects(blockGroup.children, false);
      for (const h of hits) {
        if (h.instanceId === undefined) continue;
        const list = lookup.get(h.object.userData.type);
        if (!list) continue;
        const p = decode(list[h.instanceId]);
        // ignore blocks between camera and player in 3rd person
        if (camModeRef.current === 'third' && h.distance < curDist * 0.9) continue;
        return { ...p, type: h.object.userData.type as number, normal: h.face!.normal };
      }
      return null;
    };

    const swing = () => { act.current.swing = 0.3; };
    const mine = () => {
      swing();
      const h = getHit(); if (!h) return;
      if (h.y <= 0) { setHint('Couche indestructible'); return; }
      voxels[idx(h.x, h.y, h.z)] = 0;
      rebuild(); spawnDebris(h.x, h.y, h.z, h.type);
      const drop = h.type === 1 ? 2 : h.type;
      const n = { ...invRef.current, [drop]: (invRef.current[drop] || 0) + 1 };
      invRef.current = n; setInv(n);
      if (h.type === 8) setHint('💎 Diamant récupéré !');
    };
    const place = () => {
      swing();
      const h = getHit(); if (!h) return;
      const nx = h.x + Math.round(h.normal.x), ny = h.y + Math.round(h.normal.y), nz = h.z + Math.round(h.normal.z);
      if (!inB(nx, ny, nz) || get(nx, ny, nz)) return;
      if (Math.abs(nx + 0.5 - pos.x) < 0.8 && Math.abs(nz + 0.5 - pos.z) < 0.8 && ny >= Math.floor(pos.y) - 0 && ny <= Math.floor(pos.y + 1.6)) return;
      const b = HOTBAR[selRef.current];
      const c = invRef.current[b] || 0;
      if (c <= 0) { setHint(`Plus de ${BLOCKS[b].name}`); return; }
      voxels[idx(nx, ny, nz)] = b;
      rebuild();
      const n = { ...invRef.current, [b]: c - 1 };
      invRef.current = n; setInv(n);
    };

    // ---------- Input
    const keys = new Set<string>();
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); keys.add(k);
      if (k === ' ') e.preventDefault();
      if (k >= '1' && k <= '9') setSel(+k - 1);
      if (k === 'e') mine();
      if (k === 'f') place();
      if (k === 'v') setCamMode((m) => (m === 'third' ? 'first' : 'third'));
    };
    const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

    const dom = renderer.domElement;
    let lookId: number | null = null, lx = 0, ly = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement !== dom) { dom.requestPointerLock?.(); return; }
        if (e.button === 0) mine(); else if (e.button === 2) place();
        return;
      }
      if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement === dom) {
          yaw -= e.movementX * 0.0024; pitch -= e.movementY * 0.0024;
        }
      } else if (e.pointerId === lookId) {
        yaw -= (e.clientX - lx) * 0.0065; pitch -= (e.clientY - ly) * 0.0065;
        lx = e.clientX; ly = e.clientY;
      }
      pitch = Math.max(-1.45, Math.min(1.35, pitch));
    };
    const onUp = (e: PointerEvent) => { if (e.pointerId === lookId) lookId = null; };
    const onLock = () => setLocked(document.pointerLockElement === dom);
    const onWheel = (e: WheelEvent) => { camDist = Math.max(2, Math.min(9, camDist + e.deltaY * 0.004)); };
    const noCtx = (e: Event) => e.preventDefault();
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.addEventListener('pointerlockchange', onLock);
    dom.addEventListener('wheel', onWheel, { passive: true });
    dom.addEventListener('contextmenu', noCtx);
    const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', onResize);

    // ---------- Physics
    const R = 0.3, H = 1.6;
    const collides = (px: number, py: number, pz: number) => {
      for (let x = Math.floor(px - R); x <= Math.floor(px + R); x++)
        for (let y = Math.floor(py); y <= Math.floor(py + H); y++)
          for (let z = Math.floor(pz - R); z <= Math.floor(pz + R); z++)
            if (get(x, y, z)) return true;
      return false;
    };

    const camRay = new THREE.Raycaster();
    const tmpV = new THREE.Vector3();
    let raf = 0, prev = performance.now(), appliedPreset = '';

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;

      if (appliedPreset !== presetRef.current) {
        appliedPreset = presetRef.current;
        const p = PRESETS[presetRef.current];
        sky.set(p.top, p.bottom, p.sun);
        (scene.fog as THREE.Fog).color.setHex(p.fog);
        sun.intensity = p.sunI; sun.color.setHex(p.sunCol); hemi.intensity = p.hemi;
        renderer.toneMappingExposure = p.exp;
        waterMat.color.setHex(appliedPreset === 'night' ? 0x0b3a66 : 0x1d8fd6);
      }
      if (act.current.mine) { act.current.mine = false; mine(); }
      if (act.current.place) { act.current.place = false; place(); }
      act.current.swing = Math.max(0, act.current.swing - dt);

      // Movement relative to camera
      let f = -act.current.move.y, s = act.current.move.x;
      if (keys.has('w') || keys.has('z') || keys.has('arrowup')) f += 1;
      if (keys.has('s') || keys.has('arrowdown')) f -= 1;
      if (keys.has('a') || keys.has('q') || keys.has('arrowleft')) s -= 1;
      if (keys.has('d') || keys.has('arrowright')) s += 1;
      const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
      const sprint = keys.has('shift') ? 1.6 : 1;
      const speed = 4.6 * sprint;
      const tx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * speed;
      const tz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * speed;
      const accel = onGround ? 14 : 5;
      vel.x += (tx - vel.x) * Math.min(1, accel * dt);
      vel.z += (tz - vel.z) * Math.min(1, accel * dt);
      if ((keys.has(' ') || act.current.jump) && onGround) { vel.y = 7.6; onGround = false; }
      const inWater = pos.y < WATER + 0.8;
      vel.y -= (inWater ? 8 : 22) * dt;
      if (inWater) { vel.y = Math.max(vel.y, -3); if (keys.has(' ') || act.current.jump) vel.y = 3; }

      const nx = pos.x + vel.x * dt;
      if (!collides(nx, pos.y, pos.z)) pos.x = nx;
      else if (onGround && !collides(nx, pos.y + 1.01, pos.z)) { pos.y += 1.01; pos.x = nx; }
      else vel.x = 0;
      const nz = pos.z + vel.z * dt;
      if (!collides(pos.x, pos.y, nz)) pos.z = nz;
      else if (onGround && !collides(pos.x, pos.y + 1.01, nz)) { pos.y += 1.01; pos.z = nz; }
      else vel.z = 0;
      const ny = pos.y + vel.y * dt;
      if (!collides(pos.x, ny, pos.z)) { pos.y = ny; onGround = false; }
      else { if (vel.y < 0) { pos.y = Math.floor(ny) + 1.0001; onGround = true; } vel.y = 0; }
      pos.x = Math.max(0.5, Math.min(WX - 0.5, pos.x));
      pos.z = Math.max(0.5, Math.min(WZ - 0.5, pos.z));
      if (pos.y < -3) { pos.set(WX / 2 + 0.5, heightAt(WX / 2, WZ / 2) + 2, WZ / 2 + 0.5); vel.set(0, 0, 0); }

      // Character orientation (smooth)
      const hs = Math.hypot(vel.x, vel.z);
      const third = camModeRef.current === 'third';
      let targetYaw = bodyYaw;
      if (hs > 0.4) targetYaw = Math.atan2(vel.x, vel.z);
      if (act.current.swing > 0) targetYaw = yaw + Math.PI;
      let dy = targetYaw - bodyYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      bodyYaw += dy * Math.min(1, 12 * dt);
      rig.root.position.copy(pos);
      rig.root.rotation.y = bodyYaw;
      updateCharacterAnimation(rig, dt, { speed: Math.min(1, hs / 4.6), onGround: onGround || inWater, mining: act.current.swing > 0, aimPitch: 0 });

      // ---------- Camera
      const look = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const head = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z);
      if (third) {
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const pivot = head.clone().addScaledVector(right, 0.55);
        const back = look.clone().negate();
        camRay.set(pivot, back); camRay.far = camDist + 0.3;
        const hit = camRay.intersectObjects(blockGroup.children, false)[0];
        const target = hit ? Math.max(0.4, hit.distance - 0.3) : camDist;
        curDist = target < curDist ? target : curDist + (target - curDist) * Math.min(1, 6 * dt);
        camera.position.copy(pivot).addScaledVector(back, curDist);
        camera.lookAt(tmpV.copy(pivot).addScaledVector(look, 10));
        rig.root.visible = curDist > 1.1;
      } else {
        curDist = 0;
        camera.position.copy(head).addScaledVector(look, 0.25);
        camera.lookAt(tmpV.copy(head).addScaledVector(look, 10));
        rig.root.visible = false;
      }
      camera.fov += ((keys.has('shift') && hs > 3 ? 78 : 70) - camera.fov) * Math.min(1, 6 * dt);
      camera.updateProjectionMatrix();

      // Shadows follow player
      sun.position.copy(pos).add(sunOffset);
      sun.target.position.copy(pos);
      sky.mesh.position.copy(camera.position);

      // Outline
      const h = getHit();
      if (h) { outline.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); outline.visible = true; } else outline.visible = false;

      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]; d.life -= dt; d.v.y -= 14 * dt;
        d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += 6 * dt;
        d.m.scale.setScalar(Math.max(0.01, d.life * 1.25));
        if (d.life <= 0) { scene.remove(d.m); debris.splice(i, 1); }
      }
      clouds.position.x = (now * 0.0008) % 40;
      water.position.y = WATER + 0.82 + Math.sin(now * 0.0015) * 0.04;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp); window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onLock);
      if (document.pointerLockElement) document.exitPointerLock();
      renderer.dispose();
    };
  }, [skinId, touch]);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-slate-950">
      <div ref={mountRef} className="h-full w-full touch-none" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-5 w-5 mix-blend-difference">
          <div className="absolute left-1/2 top-0 h-5 w-0.5 -translate-x-1/2 bg-white" />
          <div className="absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 bg-white" />
        </div>
      </div>

      <div className="absolute left-0 right-0 top-0 flex flex-wrap items-center justify-between gap-2 p-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button onClick={onExit} className="rounded-xl border border-white/15 bg-slate-900/80 px-3.5 py-2 text-xs font-black text-white backdrop-blur-md">← Menu</button>
        <div className="flex gap-2">
          <button onClick={() => setCamMode((m) => (m === 'third' ? 'first' : 'third'))} className="rounded-xl bg-indigo-600/90 px-3 py-2 text-xs font-bold text-white">
            🎥 {camMode === 'third' ? '3e personne' : '1re personne'}
          </button>
          <button onClick={() => setTimePreset((t) => (t === 'day' ? 'sunset' : t === 'sunset' ? 'night' : 'day'))} className="rounded-xl bg-slate-900/80 px-3 py-2 text-xs font-bold text-white">
            {timePreset === 'day' ? '☀️ Jour' : timePreset === 'sunset' ? '🌅 Crépuscule' : '🌙 Nuit'}
          </button>
        </div>
      </div>

      {hint && <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-xl bg-slate-900/85 px-4 py-1.5 text-xs font-bold text-emerald-300">{hint}</div>}

      {!touch && !locked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/15 bg-slate-900/85 px-6 py-5 text-center text-white shadow-2xl backdrop-blur-md">
            <div className="text-lg font-black">🖱️ Clique pour contrôler la caméra</div>
            <div className="mt-2 text-xs leading-relaxed text-white/75">
              Souris : regarder · ZQSD/WASD : bouger · Maj : sprint · Espace : sauter<br />
              Clic gauche : miner · Clic droit : poser · 1-9 : bloc · Molette : zoom · V : vue · Échap : libérer
            </div>
          </div>
        </div>
      )}

      <div className="absolute left-1/2 flex -translate-x-1/2 gap-1 rounded-2xl border border-white/20 bg-slate-900/85 p-1.5 backdrop-blur-md" style={{ bottom: touch ? 165 : 18 }}>
        {HOTBAR.map((id, i) => (
          <button key={id} onClick={() => setSel(i)} className={`relative flex h-10 w-10 items-center justify-center rounded-xl border-2 text-lg sm:h-12 sm:w-12 ${sel === i ? 'border-emerald-400 bg-emerald-500/25' : 'border-white/10 bg-white/5'}`}>
            {BLOCKS[id].emoji}
            <span className="absolute bottom-0.5 right-1 text-[10px] font-black text-white">{inv[id] || 0}</span>
          </button>
        ))}
      </div>

      {touch && (
        <>
          <div className="pointer-events-none absolute right-4 rounded bg-black/40 px-2 py-0.5 text-[10px] text-white/80" style={{ bottom: 228 }}>Glisse l'écran pour tourner la caméra</div>
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <Joystick onMove={(v) => (act.current.move = v)} size={125} />
            <div className="flex items-end gap-2.5">
              <HoldButton label="⛏️" className="h-14 w-14 bg-amber-500/90 text-2xl" onDown={() => (act.current.mine = true)} />
              <HoldButton label="🧱" className="h-14 w-14 bg-sky-500/90 text-2xl" onDown={() => (act.current.place = true)} />
              <HoldButton label="⤒" className="h-16 w-16 bg-emerald-500/90 text-2xl" onDown={() => (act.current.jump = true)} onUp={() => (act.current.jump = false)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
