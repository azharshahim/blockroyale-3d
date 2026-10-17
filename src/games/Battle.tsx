import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Joystick, { HoldButton, isTouch, Vec } from './Joystick';
import {
  CharacterRig,
  createCharacter3D,
  SKINS,
  SkinId,
  updateCharacterAnimation,
} from './Character3D';
import { getBattleGroundTexture, getBlockMaterials } from './textures3D';
import { createGrassGeometry, createGrassMaterial, createSky } from './sky';

const ARENA = 220; // -110 .. +110 meters
const BOT_NAMES = [
  'Ninja3D',
  'JonesyHD',
  'MidasGold',
  'RavenX',
  'DriftNeo',
  'LynxCyber',
  'PeelyPro',
  'AuraStar',
  'OmegaDark',
  'BriteSlayer',
  'SkullKing',
  'CrystalV',
  'Ragnarok',
  'Calamity',
  'Meowscles',
  'Fishstick',
  'ValorHD',
  'ZeroPoint',
  'Spectre',
];

type HudState = {
  hp: number;
  shield: number;
  ammo: number;
  mats: number;
  alive: number;
  kills: number;
  stormText: string;
  inStorm: boolean;
  feed: string[];
  targetName: string | null;
  targetHp: number;
};

export default function Battle({
  onExit,
  skinId = 'cyber',
}: {
  onExit: () => void;
  skinId?: SkinId;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const touch = isTouch();

  const [hud, setHud] = useState<HudState>({
    hp: 100,
    shield: 50,
    ammo: 90,
    mats: 120,
    alive: 20,
    kills: 0,
    stormText: 'Tempête 3D stable',
    inStorm: false,
    feed: [],
    targetName: null,
    targetHp: 0,
  });
  const [end, setEnd] = useState<null | { win: boolean; place: number; kills: number }>(null);
  const [round, setRound] = useState(0);
  const [hitMarker, setHitMarker] = useState(false);
  const [locked, setLocked] = useState(false);

  const inputRef = useRef({
    move: { x: 0, y: 0 } as Vec,
    jump: false,
    fire: false,
    buildWall: false,
    buildRamp: false,
  });

  useEffect(() => {
    const container = mountRef.current!;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcfe6ff, 60, 260);

    const camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      360
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // HD Lighting
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x166534, 0.8);
    scene.add(hemi);

    // Sky dome, distant mountains, grass
    const sunOffset = new THREE.Vector3(55, 80, 40);
    const sky = createSky(sunOffset);
    sky.set(0x2563c9, 0xd6ecff, 0xfff1c2);
    scene.add(sky.mesh);
    const mountMat = new THREE.MeshStandardMaterial({ color: 0x5b7a6a, roughness: 1, flatShading: true });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 230 + (i % 3) * 30;
      const h = 40 + ((i * 37) % 45);
      const m = new THREE.Mesh(new THREE.ConeGeometry(35 + (i % 4) * 10, h, 6), mountMat);
      m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
      m.rotation.y = i;
      scene.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry((35 + (i % 4) * 10) * 0.3, h * 0.3, 6), snowMat);
      cap.position.y = h * 0.36;
      m.add(cap);
    }
    {
      const gGeo = createGrassGeometry();
      const gMat = createGrassMaterial(0x6cc04a);
      const N = touch ? 1500 : 4000;
      const grass = new THREE.InstancedMesh(gGeo, gMat, N);
      const mm = new THREE.Matrix4();
      for (let i = 0; i < N; i++) {
        mm.makeRotationY(Math.random() * Math.PI);
        mm.scale(new THREE.Vector3(1.4, 1 + Math.random(), 1.4));
        mm.setPosition((Math.random() - 0.5) * ARENA * 0.96, 0, (Math.random() - 0.5) * ARENA * 0.96);
        grass.setMatrixAt(i, mm);
      }
      grass.receiveShadow = true;
      scene.add(grass);
    }

    const sun = new THREE.DirectionalLight(0xfffbeb, 1.65);
    sun.position.set(65, 95, 55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 260;
    const sd = 95;
    sun.shadow.camera.left = -sd;
    sun.shadow.camera.right = sd;
    sun.shadow.camera.top = sd;
    sun.shadow.camera.bottom = -sd;
    sun.shadow.bias = -0.0005;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    // Island Ground 3D + Ocean Surround
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.5 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.6;
    scene.add(ocean);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(ARENA, 1.2, ARENA),
      new THREE.MeshStandardMaterial({
        map: getBattleGroundTexture(),
        roughness: 0.85,
      })
    );
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    scene.add(ground);

    // Obstacles, Trees, Rocks & Built Structures
    type Structure3D = {
      mesh: THREE.Mesh;
      box: THREE.Box3;
      hp: number;
      isRamp?: boolean;
      isTree?: boolean;
    };
    const structures: Structure3D[] = [];

    const woodMat = getBlockMaterials(7) as THREE.Material;
    const brickMat = getBlockMaterials(11) as THREE.Material;

    const addBoxStructure = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
      hp = 180
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const box = new THREE.Box3().setFromObject(mesh);
      structures.push({ mesh, box, hp });
      return mesh;
    };

    // Spawn Tactical Forts / Houses on the Island
    const fortSpots = [
      [-45, -45],
      [48, -42],
      [-42, 48],
      [45, 45],
      [0, -58],
      [0, 58],
    ];
    for (const [fx, fz] of fortSpots) {
      addBoxStructure(fx, 1.6, fz - 4, 8, 3.2, 0.5, brickMat, 350);
      addBoxStructure(fx, 1.6, fz + 4, 8, 3.2, 0.5, brickMat, 350);
      addBoxStructure(fx - 4, 1.6, fz, 0.5, 3.2, 8, brickMat, 350);
      // Roof platform
      addBoxStructure(fx, 3.3, fz, 8.4, 0.35, 8.4, woodMat, 350);
    }

    // Spawn 3D Pine & Oak Trees + Boulders
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1b, roughness: 0.85 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.65, metalness: 0.15 });

    for (let i = 0; i < 65; i++) {
      const tx = rand(-ARENA * 0.45, ARENA * 0.45);
      const tz = rand(-ARENA * 0.45, ARENA * 0.45);
      if (Math.hypot(tx, tz) < 12) continue;
      if (i % 4 === 0) {
        // 3D Rock Boulder
        const r = rand(1.1, 2.0);
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), rockMat);
        rock.position.set(tx, r * 0.7, tz);
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
        structures.push({
          mesh: rock,
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(tx, r, tz),
            new THREE.Vector3(r * 1.6, r * 1.8, r * 1.6)
          ),
          hp: 160,
          isTree: true,
        });
      } else {
        // 3D Pine Tree
        const treeGroup = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 8), trunkMat);
        treeGroup.position.set(tx, 1.3, tz);
        treeGroup.castShadow = true;
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.2, 8), foliageMat);
        cone1.position.y = 2.0;
        cone1.castShadow = true;
        treeGroup.add(cone1);
        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.6, 8), foliageMat);
        cone2.position.y = 3.5;
        cone2.castShadow = true;
        treeGroup.add(cone2);
        scene.add(treeGroup);
        structures.push({
          mesh: treeGroup,
          box: new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(tx, 2.2, tz),
            new THREE.Vector3(1.2, 4.4, 1.2)
          ),
          hp: 90,
          isTree: true,
        });
      }
    }

    // 3D Glowing Golden Loot Chests & Floating Pickups
    type Loot3D = {
      mesh: THREE.Mesh;
      kind: 'ammo' | 'heal' | 'shield' | 'mats';
      amount: number;
    };
    const loots: Loot3D[] = [];
    const chestMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.75,
    });

    const spawnLootItem = (
      x: number,
      z: number,
      kind: Loot3D['kind'],
      amount: number
    ) => {
      const colors = {
        ammo: 0xfacc15,
        heal: 0x22c55e,
        shield: 0x38bdf8,
        mats: 0xd97706,
      };
      const geo =
        kind === 'shield'
          ? new THREE.OctahedronGeometry(0.45, 0)
          : new THREE.BoxGeometry(0.65, 0.65, 0.65);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: colors[kind],
          emissive: colors[kind],
          emissiveIntensity: 0.5,
          roughness: 0.25,
          metalness: 0.5,
        })
      );
      mesh.position.set(x, 0.65, z);
      mesh.castShadow = true;
      scene.add(mesh);
      loots.push({ mesh, kind, amount });
    };

    type Chest3D = { mesh: THREE.Mesh; open: boolean };
    const chests: Chest3D[] = [];
    for (let i = 0; i < 24; i++) {
      const cx = rand(-ARENA * 0.42, ARENA * 0.42);
      const cz = rand(-ARENA * 0.42, ARENA * 0.42);
      const cm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.75), chestMat);
      cm.position.set(cx, 0.38, cz);
      cm.castShadow = true;
      scene.add(cm);
      chests.push({ mesh: cm, open: false });
    }

    // 20 3D Articulated Units (Player 0 + 19 AI Bots)
    type Unit3D = {
      id: number;
      name: string;
      bot: boolean;
      rig: CharacterRig;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      yaw: number;
      pitch: number;
      hp: number;
      shield: number;
      ammo: number;
      mats: number;
      alive: boolean;
      onGround: boolean;
      kills: number;
      cd: number;
      buildCd: number;
      aiTarget: THREE.Vector3;
      aiThink: number;
    };

    const units: Unit3D[] = [];
    const playerSkin = SKINS.find((s) => s.id === skinId) || SKINS[0];

    for (let i = 0; i < 20; i++) {
      const isMe = i === 0;
      const skin = isMe ? playerSkin : SKINS[i % SKINS.length];
      const rig = createCharacter3D(skin, 'gun');
      rig.root.scale.setScalar(0.9);
      scene.add(rig.root);

      const angle = (i / 20) * Math.PI * 2;
      const dist = isMe ? 8 : rand(25, ARENA * 0.42);
      const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

      units.push({
        id: i,
        name: isMe ? 'Toi' : BOT_NAMES[(i - 1) % BOT_NAMES.length],
        bot: !isMe,
        rig,
        pos,
        vel: new THREE.Vector3(),
        yaw: rand(0, Math.PI * 2),
        pitch: 0,
        hp: 100,
        shield: isMe ? 50 : 25,
        ammo: isMe ? 90 : 999,
        mats: isMe ? 120 : 60,
        alive: true,
        onGround: true,
        kills: 0,
        cd: 0,
        buildCd: 0,
        aiTarget: pos.clone(),
        aiThink: 0,
      });
    }

    const me = units[0];

    // 3D Shrinking Storm Cylinder
    const storm = {
      x: 0,
      z: 0,
      r: ARENA * 0.62,
      targetR: ARENA * 0.35,
      timer: 20,
      shrinking: false,
      phase: 1,
    };

    const stormGeo = new THREE.CylinderGeometry(1, 1, 60, 48, 1, true);
    const stormMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const stormMesh = new THREE.Mesh(stormGeo, stormMat);
    stormMesh.position.y = 28;
    stormMesh.scale.set(storm.r, 1, storm.r);
    scene.add(stormMesh);

    // 3D Bullets / Tracers
    type Bullet3D = {
      mesh: THREE.Mesh;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      owner: number;
      dmg: number;
      life: number;
      dist: number;
    };
    const bullets: Bullet3D[] = [];
    const bulletGeo = new THREE.SphereGeometry(0.11, 6, 6);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const feed: string[] = [];

    const fireWeapon = (u: Unit3D) => {
      if (u.cd > 0 || u.ammo <= 0 || !u.alive) return;
      u.cd = u.bot ? 0.42 : 0.14;
      u.ammo--;

      const spread = u.bot ? 0.08 : 0.015;
      const yawSpread = u.yaw + (Math.random() - 0.5) * spread;
      const pitchSpread = u.pitch + (Math.random() - 0.5) * spread;

      const dir = new THREE.Vector3(
        -Math.sin(yawSpread) * Math.cos(pitchSpread),
        Math.sin(pitchSpread),
        -Math.cos(yawSpread) * Math.cos(pitchSpread)
      ).normalize();

      const spawnPos = u.pos
        .clone()
        .add(new THREE.Vector3(0, 1.35, 0))
        .addScaledVector(dir, 1.1);

      const m = new THREE.Mesh(bulletGeo, bulletMat);
      m.position.copy(spawnPos);
      scene.add(m);

      bullets.push({
        mesh: m,
        pos: spawnPos,
        vel: dir.multiplyScalar(78),
        owner: u.id,
        dmg: u.bot ? 10 : 24,
        life: 1.6,
        dist: 0,
      });

      u.rig.recoilTime = 0.14;
    };

    // 3D Fortnite Building (Wall or Ramp)
    const buildStructure = (u: Unit3D, kind: 'wall' | 'ramp') => {
      if (u.mats < 10 || u.buildCd > 0 || !u.alive) return;
      u.mats -= 10;
      u.buildCd = 0.3;
      u.rig.swingTime = 0.4;

      const forward = new THREE.Vector3(-Math.sin(u.yaw), 0, -Math.cos(u.yaw));
      const pos = u.pos.clone().addScaledVector(forward, 3.2);

      if (kind === 'wall') {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 0.35), woodMat);
        wall.position.set(pos.x, u.pos.y + 1.4, pos.z);
        wall.rotation.y = u.yaw;
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        structures.push({
          mesh: wall,
          box: new THREE.Box3().setFromObject(wall),
          hp: 160,
        });
      } else {
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 4.2), woodMat);
        ramp.position.set(pos.x, u.pos.y + 1.25, pos.z);
        ramp.rotation.y = u.yaw;
        ramp.rotation.x = 0.55;
        ramp.castShadow = true;
        ramp.receiveShadow = true;
        scene.add(ramp);
        structures.push({
          mesh: ramp,
          box: new THREE.Box3().setFromObject(ramp),
          hp: 160,
          isRamp: true,
        });
      }
    };

    const applyDamage = (target: Unit3D, dmg: number, attacker: Unit3D | null) => {
      if (!target.alive) return;
      const absorbed = Math.min(target.shield, dmg);
      target.shield -= absorbed;
      target.hp -= dmg - absorbed;

      if (attacker === me) {
        setHitMarker(true);
        setTimeout(() => setHitMarker(false), 120);
      }

      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        target.rig.root.rotation.x = -Math.PI / 2;
        target.rig.root.position.y = 0.25;
        if (attacker) attacker.kills++;
        const msg = attacker
          ? `${attacker.name} 🔫 ${target.name}`
          : `${target.name} ⚡ Tempête`;
        feed.unshift(msg);
        if (feed.length > 4) feed.pop();

        // Drop 3D Loot
        spawnLootItem(target.pos.x - 0.8, target.pos.z, 'ammo', 35);
        spawnLootItem(target.pos.x + 0.8, target.pos.z, 'mats', 40);
        spawnLootItem(target.pos.x, target.pos.z + 0.8, 'shield', 25);
      }
    };

    // Controls: Keyboard + Mouse / Touch Camera Look
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.add(k);
      if (k === ' ') e.preventDefault();
      if (k === 'f' || k === 'q') buildStructure(me, 'wall');
      if (k === 'r' || k === 'e') buildStructure(me, 'ramp');
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Camera look: pointer lock on desktop, drag on touch
    let lookId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let camDistWanted = 4.6;
    let camDistCur = 4.6;
    const camRay = new THREE.Raycaster();
    const colliderMeshes = () => structures.map((s) => s.mesh);

    const dom = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement !== dom) {
          dom.requestPointerLock?.();
          return;
        }
        if (e.button === 0) inputRef.current.fire = true;
        if (e.button === 2) buildStructure(me, 'wall');
        return;
      }
      if (lookId === null) {
        lookId = e.pointerId;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement !== dom) return;
        me.yaw -= e.movementX * 0.0024;
        me.pitch -= e.movementY * 0.0022;
      } else if (lookId === e.pointerId) {
        me.yaw -= (e.clientX - lastX) * 0.006;
        me.pitch -= (e.clientY - lastY) * 0.005;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      me.pitch = Math.max(-0.9, Math.min(0.8, me.pitch));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (lookId === e.pointerId) lookId = null;
      if (e.pointerType === 'mouse' && e.button === 0) inputRef.current.fire = false;
    };
    const onLockChange = () => setLocked(document.pointerLockElement === dom);
    const onWheel = (e: WheelEvent) => {
      camDistWanted = Math.max(2.5, Math.min(8, camDistWanted + e.deltaY * 0.004));
    };
    const onContext = (e: Event) => e.preventDefault();

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    document.addEventListener('pointerlockchange', onLockChange);
    dom.addEventListener('wheel', onWheel, { passive: true });
    dom.addEventListener('contextmenu', onContext);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // Move unit with structure collision & ramp climbing
    const moveUnit3D = (u: Unit3D, dx: number, dz: number, dt: number) => {
      const nextX = Math.max(-ARENA * 0.48, Math.min(ARENA * 0.48, u.pos.x + dx));
      const nextZ = Math.max(-ARENA * 0.48, Math.min(ARENA * 0.48, u.pos.z + dz));
      const testPoint = new THREE.Vector3(nextX, u.pos.y + 0.9, nextZ);

      let blocked = false;
      let climbY = 0;
      for (const s of structures) {
        if (s.box.containsPoint(testPoint)) {
          if (s.isRamp) {
            climbY = Math.min(3.5, u.pos.y + 5.5 * dt);
          } else if (u.pos.y < s.box.max.y - 0.35) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) {
        u.pos.x = nextX;
        u.pos.z = nextZ;
        if (climbY > u.pos.y) {
          u.pos.y = climbY;
          u.onGround = true;
        }
      }
    };

    let raf = 0;
    let prev = performance.now();
    let hudTick = 0;
    let stormDmgTick = 0;
    let ended = false;

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      // Check mobile build buttons
      if (inputRef.current.buildWall) {
        inputRef.current.buildWall = false;
        buildStructure(me, 'wall');
      }
      if (inputRef.current.buildRamp) {
        inputRef.current.buildRamp = false;
        buildStructure(me, 'ramp');
      }

      // --- Update Player (Me)
      if (me.alive) {
        me.cd = Math.max(0, me.cd - dt);
        me.buildCd = Math.max(0, me.buildCd - dt);

        let fwd = -inputRef.current.move.y;
        let str = inputRef.current.move.x;
        if (keys.has('w') || keys.has('z') || keys.has('arrowup')) fwd += 1;
        if (keys.has('s') || keys.has('arrowdown')) fwd -= 1;
        if (keys.has('a') || keys.has('q') || keys.has('arrowleft')) str -= 1;
        if (keys.has('d') || keys.has('arrowright')) str += 1;

        const len = Math.hypot(fwd, str);
        if (len > 1) {
          fwd /= len;
          str /= len;
        }

        const speed = 10.5;
        const sinY = Math.sin(me.yaw);
        const cosY = Math.cos(me.yaw);
        const vx = (-sinY * fwd + cosY * str) * speed;
        const vz = (-cosY * fwd - sinY * str) * speed;

        moveUnit3D(me, vx * dt, vz * dt, dt);

        if ((keys.has(' ') || inputRef.current.jump) && me.onGround) {
          me.vel.y = 8.5;
          me.onGround = false;
        }
        me.vel.y -= 21 * dt;
        me.pos.y += me.vel.y * dt;

        // Check roof / ground landing
        let floorY = 0;
        for (const s of structures) {
          if (
            me.pos.x >= s.box.min.x &&
            me.pos.x <= s.box.max.x &&
            me.pos.z >= s.box.min.z &&
            me.pos.z <= s.box.max.z &&
            me.pos.y >= s.box.max.y - 0.45
          ) {
            floorY = Math.max(floorY, s.box.max.y);
          }
        }
        if (me.pos.y <= floorY) {
          me.pos.y = floorY;
          me.vel.y = 0;
          me.onGround = true;
        }

        // Smart Aim Assist when firing on mobile / touch
        const firing = inputRef.current.fire || keys.has(' ');
        if (firing) {
          if (touch) {
            let bestEnemy: Unit3D | null = null;
            let bestDist = 42;
            for (const o of units) {
              if (o !== me && o.alive) {
                const d = o.pos.distanceTo(me.pos);
                if (d < bestDist) {
                  bestDist = d;
                  bestEnemy = o;
                }
              }
            }
            if (bestEnemy) {
              me.yaw = Math.atan2(me.pos.x - bestEnemy.pos.x, me.pos.z - bestEnemy.pos.z);
              me.pitch = Math.atan2(
                bestEnemy.pos.y - me.pos.y,
                Math.hypot(bestEnemy.pos.x - me.pos.x, bestEnemy.pos.z - me.pos.z)
              );
            }
          }
          fireWeapon(me);
        }

        // Open nearby 3D Chests
        for (const c of chests) {
          if (!c.open && c.mesh.position.distanceTo(me.pos) < 3.2) {
            c.open = true;
            c.mesh.scale.y = 0.45;
            spawnLootItem(c.mesh.position.x - 0.9, c.mesh.position.z, 'shield', 25);
            spawnLootItem(c.mesh.position.x + 0.9, c.mesh.position.z, 'ammo', 40);
            spawnLootItem(c.mesh.position.x, c.mesh.position.z + 0.9, 'mats', 50);
          }
        }

        // Pickup 3D Loot items
        for (let i = loots.length - 1; i >= 0; i--) {
          const L = loots[i];
          L.mesh.rotation.y += 2.5 * dt;
          if (L.mesh.position.distanceTo(me.pos) < 2.3) {
            if (L.kind === 'ammo') me.ammo += L.amount;
            if (L.kind === 'mats') me.mats += L.amount;
            if (L.kind === 'heal') me.hp = Math.min(100, me.hp + L.amount);
            if (L.kind === 'shield') me.shield = Math.min(100, me.shield + L.amount);
            scene.remove(L.mesh);
            loots.splice(i, 1);
          }
        }

        me.rig.root.position.copy(me.pos);
        me.rig.root.rotation.y = me.yaw + Math.PI;
        updateCharacterAnimation(me.rig, dt, {
          speed: Math.min(1, len),
          onGround: me.onGround,
          aiming: true,
          shooting: firing,
          aimPitch: me.pitch,
        });
      }

      // --- Update AI Bots in 3D
      for (const u of units) {
        if (!u.bot || !u.alive) continue;
        u.cd = Math.max(0, u.cd - dt);
        u.buildCd = Math.max(0, u.buildCd - dt);
        u.aiThink -= dt;

        // Find nearest enemy
        let target: Unit3D | null = null;
        let bestD = 38;
        for (const o of units) {
          if (o !== u && o.alive) {
            const d = o.pos.distanceTo(u.pos);
            if (d < bestD) {
              bestD = d;
              target = o;
            }
          }
        }

        const outsideStorm = Math.hypot(u.pos.x - storm.x, u.pos.z - storm.z) > storm.r * 0.85;
        if (outsideStorm || u.aiThink <= 0) {
          u.aiThink = 3 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * storm.r * 0.55;
          u.aiTarget.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        }

        let moveDir = u.aiTarget.clone().sub(u.pos);
        moveDir.y = 0;

        if (target && !outsideStorm) {
          u.yaw = Math.atan2(u.pos.x - target.pos.x, u.pos.z - target.pos.z);
          if (Math.random() < 0.08) fireWeapon(u);
          if (u.hp < 55 && Math.random() < 0.015) buildStructure(u, 'wall');
          // Strafe around target
          const strafeAngle = u.yaw + Math.PI / 2;
          moveDir.set(Math.sin(strafeAngle), 0, Math.cos(strafeAngle));
        } else if (moveDir.lengthSq() > 1) {
          moveDir.normalize();
          u.yaw = Math.atan2(-moveDir.x, -moveDir.z);
        }

        const botSpeed = 6.2;
        if (moveDir.lengthSq() > 0.2) {
          moveDir.normalize();
          moveUnit3D(u, moveDir.x * botSpeed * dt, moveDir.z * botSpeed * dt, dt);
        }

        u.rig.root.position.copy(u.pos);
        u.rig.root.rotation.y = u.yaw + Math.PI;
        updateCharacterAnimation(u.rig, dt, {
          speed: 0.75,
          onGround: true,
          aiming: Boolean(target),
          shooting: u.rig.recoilTime > 0,
        });
      }

      // --- Update 3D Projectiles & Collisions
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.life -= dt;
        const prevX = b.pos.x, prevY = b.pos.y, prevZ = b.pos.z;
        b.pos.addScaledVector(b.vel, dt);
        b.dist += Math.hypot(b.pos.x - prevX, b.pos.y - prevY, b.pos.z - prevZ);
        b.mesh.position.copy(b.pos);

        let remove = b.life <= 0 || b.pos.y < -2;
        const travel = Math.hypot(b.pos.x - prevX, b.pos.y - prevY, b.pos.z - prevZ);
        // Sweep the whole flight path so fast bullets can never skip an enemy
        const steps = Math.max(1, Math.ceil(travel / 0.25));
        sweep:
        for (let k = 1; k <= steps && !remove; k++) {
          const t = k / steps;
          const px = prevX + (b.pos.x - prevX) * t;
          const py = prevY + (b.pos.y - prevY) * t;
          const pz = prevZ + (b.pos.z - prevZ) * t;

          // Walls/trees only block once the bullet has left the muzzle (prevents
          // the shooter being stuck in his own build or inside a fort wall)
          if (b.dist > 1.5) {
            for (let j = structures.length - 1; j >= 0; j--) {
              const st = structures[j];
              if (st.box.containsPoint({ x: px, y: py, z: pz } as THREE.Vector3)) {
                st.hp -= b.dmg;
                if (b.owner === 0 && st.isTree) me.mats += 8;
                if (st.hp <= 0) { scene.remove(st.mesh); structures.splice(j, 1); }
                remove = true;
                break sweep;
              }
            }
          }

          for (const u of units) {
            if (u.alive && u.id !== b.owner) {
              const dx = u.pos.x - px;
              const dz = u.pos.z - pz;
              const dy = py - u.pos.y;
              if (dx * dx + dz * dz < 1.05 && dy >= -0.25 && dy <= 2.15) {
                applyDamage(u, b.dmg, units[b.owner]);
                remove = true;
                break sweep;
              }
            }
          }
        }

        if (remove) {
          scene.remove(b.mesh);
          bullets.splice(i, 1);
        }
      }

      // --- Update 3D Storm Wall
      storm.timer -= dt;
      if (storm.timer <= 0) {
        storm.shrinking = !storm.shrinking;
        storm.timer = storm.shrinking ? 18 : 15;
        if (!storm.shrinking) {
          storm.phase++;
          storm.targetR = Math.max(16, storm.r * 0.58);
        }
      }
      if (storm.shrinking && storm.r > storm.targetR) {
        storm.r = Math.max(storm.targetR, storm.r - 2.4 * dt);
        stormMesh.scale.set(storm.r, 1, storm.r);
      }

      stormDmgTick += dt;
      if (stormDmgTick >= 1.0) {
        stormDmgTick = 0;
        for (const u of units) {
          if (u.alive && Math.hypot(u.pos.x - storm.x, u.pos.z - storm.z) > storm.r) {
            applyDamage(u, 2 + storm.phase, null);
          }
        }
      }

      // --- Over-the-shoulder camera with collision + smoothing
      const camTarget = me.alive ? me : units.find((u) => u.alive) || me;
      const forward = new THREE.Vector3(
        -Math.sin(camTarget.yaw) * Math.cos(camTarget.pitch),
        Math.sin(camTarget.pitch),
        -Math.cos(camTarget.yaw) * Math.cos(camTarget.pitch)
      );
      const right = new THREE.Vector3(Math.cos(camTarget.yaw), 0, -Math.sin(camTarget.yaw));
      const pivot = camTarget.pos.clone().add(new THREE.Vector3(0, 1.7, 0)).addScaledVector(right, 0.75);
      const back = forward.clone().negate();
      camRay.set(pivot, back);
      camRay.far = camDistWanted + 0.4;
      const camHit = camRay.intersectObjects(colliderMeshes(), true)[0];
      const wantDist = camHit ? Math.max(0.6, camHit.distance - 0.35) : camDistWanted;
      camDistCur = wantDist < camDistCur ? wantDist : camDistCur + (wantDist - camDistCur) * Math.min(1, 5 * dt);
      const camPos = pivot.clone().addScaledVector(back, camDistCur);
      camPos.y = Math.max(0.5, camPos.y);
      camera.position.lerp(camPos, Math.min(1, 22 * dt));
      camera.lookAt(pivot.clone().addScaledVector(forward, 20));
      camTarget.rig.root.visible = camDistCur > 1.0 || !camTarget.alive;
      const firingNow = inputRef.current.fire || keys.has(' ');
      camera.fov += ((firingNow ? 55 : 64) - camera.fov) * Math.min(1, 8 * dt);
      camera.updateProjectionMatrix();
      sky.mesh.position.copy(camera.position);
      sun.position.copy(camTarget.pos).add(sunOffset);
      sun.target.position.copy(camTarget.pos);

      // Check victory / elimination
      const aliveCount = units.filter((u) => u.alive).length;
      if (!ended && (!me.alive || aliveCount === 1)) {
        ended = true;
        if (me.alive) {
          updateCharacterAnimation(me.rig, dt, { speed: 0, onGround: true, dancing: true });
        }
        setTimeout(() => {
          setEnd({
            win: me.alive,
            place: me.alive ? 1 : aliveCount + 1,
            kills: me.kills,
          });
        }, 800);
      }

      // --- Draw 2D Radar Minimap
      const mini = minimapRef.current;
      if (mini) {
        const mctx = mini.getContext('2d')!;
        const mw = mini.width;
        mctx.clearRect(0, 0, mw, mw);
        mctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        mctx.fillRect(0, 0, mw, mw);

        const toMap = (v: number) => ((v + ARENA / 2) / ARENA) * mw;
        // Safe zone circle
        mctx.strokeStyle = '#c084fc';
        mctx.lineWidth = 2;
        mctx.beginPath();
        mctx.arc(toMap(storm.x), toMap(storm.z), (storm.r / ARENA) * mw, 0, Math.PI * 2);
        mctx.stroke();

        // Enemies
        for (const u of units) {
          if (!u.alive) continue;
          mctx.fillStyle = u === me ? '#38bdf8' : '#ef4444';
          mctx.beginPath();
          mctx.arc(toMap(u.pos.x), toMap(u.pos.z), u === me ? 4 : 2.5, 0, Math.PI * 2);
          mctx.fill();
        }
      }

      // Update React HUD periodically
      hudTick += dt;
      if (hudTick > 0.12) {
        hudTick = 0;
        // Check enemy near crosshair
        let aimedEnemy: Unit3D | null = null;
        for (const u of units) {
          if (u !== me && u.alive && u.pos.distanceTo(me.pos) < 45) {
            const toEnemy = u.pos.clone().sub(me.pos).normalize();
            if (toEnemy.dot(forward) > 0.94) {
              aimedEnemy = u;
              break;
            }
          }
        }

        setHud({
          hp: Math.round(me.hp),
          shield: Math.round(me.shield),
          ammo: me.ammo,
          mats: me.mats,
          alive: aliveCount,
          kills: me.kills,
          stormText: storm.shrinking
            ? '⚡ Tempête 3D en mouvement !'
            : `🌀 Phase ${storm.phase} (${Math.ceil(storm.timer)}s)`,
          inStorm: Math.hypot(me.pos.x - storm.x, me.pos.z - storm.z) > storm.r,
          feed: [...feed],
          targetName: aimedEnemy ? aimedEnemy.name : null,
          targetHp: aimedEnemy ? Math.round(aimedEnemy.hp + aimedEnemy.shield) : 0,
        });
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('pointerlockchange', onLockChange);
      if (document.pointerLockElement) document.exitPointerLock();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [round, skinId, touch]);

  const restart = () => {
    setEnd(null);
    inputRef.current.fire = false;
    setRound((r) => r + 1);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-950 select-none">
      <div ref={mountRef} className="h-full w-full touch-none" />

      {/* Storm Warning Vignette when outside Safe Zone */}
      {hud.inStorm && (
        <div className="pointer-events-none absolute inset-0 border-8 border-purple-500/60 bg-purple-900/25 animate-pulse" />
      )}

      {/* Center Tactical Reticle + Hitmarker */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex h-8 w-8 items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-yellow-300 shadow" />
          <div className="absolute top-0 h-2 w-0.5 bg-white/90" />
          <div className="absolute bottom-0 h-2 w-0.5 bg-white/90" />
          <div className="absolute left-0 h-0.5 w-2 bg-white/90" />
          <div className="absolute right-0 h-0.5 w-2 bg-white/90" />
          {hitMarker && (
            <div className="absolute text-lg font-black text-red-400">✕</div>
          )}
        </div>
        {hud.targetName && (
          <div className="mt-2 whitespace-nowrap rounded-lg bg-black/75 px-2 py-0.5 text-center text-[11px] font-bold text-red-400">
            🎯 {hud.targetName} ({hud.targetHp} PV)
          </div>
        )}
      </div>

      {/* Top Bar: Menu, Alive Counter, Storm Status & Radar Minimap */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex flex-col gap-2">
          <button
            onClick={onExit}
            className="pointer-events-auto rounded-xl border border-white/15 bg-slate-900/80 px-3.5 py-2 text-xs font-black text-white shadow-lg backdrop-blur-md hover:bg-slate-800"
          >
            ← Menu 3D
          </button>
          <div className="space-y-1">
            {hud.feed.map((f, i) => (
              <div
                key={i}
                className="rounded-lg bg-slate-900/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"
              >
                {f}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex gap-2 text-xs font-black text-white sm:text-sm">
            <span className="rounded-xl border border-white/15 bg-slate-900/85 px-3 py-1.5 shadow-lg">
              👥 {hud.alive} / 20
            </span>
            <span className="rounded-xl border border-white/15 bg-slate-900/85 px-3 py-1.5 shadow-lg">
              🎯 {hud.kills} Kills
            </span>
          </div>
          <span className="rounded-full bg-purple-700/85 px-3 py-0.5 text-[11px] font-bold text-white shadow">
            {hud.stormText}
          </span>
        </div>

        {/* 2D Radar Minimap */}
        <canvas
          ref={minimapRef}
          width={110}
          height={110}
          className="rounded-2xl border-2 border-white/30 shadow-2xl"
        />
      </div>

      {/* Bottom Player Status Bars (Shield, Health, Ammo, Wood) */}
      <div
        className="pointer-events-none absolute left-1/2 w-72 -translate-x-1/2 space-y-1.5 rounded-2xl border border-white/15 bg-slate-900/80 p-3 shadow-2xl backdrop-blur-md"
        style={{ bottom: touch ? 165 : 18 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-sky-400">🛡️</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-all"
              style={{ width: `${hud.shield}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs font-black text-sky-300">{hud.shield}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-400">❤️</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all"
              style={{ width: `${hud.hp}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs font-black text-emerald-300">{hud.hp}</span>
        </div>
        <div className="flex justify-between pt-1 text-xs font-black text-white">
          <span className="rounded-lg bg-white/10 px-2.5 py-1">🔫 Munitions : {hud.ammo}</span>
          <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-amber-300">
            🪵 Bois : {hud.mats}
          </span>
        </div>
      </div>

      {!touch && !locked && !end && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="rounded-2xl border border-white/15 bg-slate-900/85 px-6 py-5 text-center text-white shadow-2xl backdrop-blur-md">
            <div className="text-lg font-black">🖱️ Clique pour contrôler la caméra</div>
            <div className="mt-2 text-xs text-white/75">Souris : viser · Clic gauche : tirer · Molette : zoom · Échap : libérer</div>
          </div>
        </div>
      )}
      {/* Desktop Controls Overlay */}
      {!touch && (
        <div className="pointer-events-none absolute bottom-4 left-3 rounded-xl border border-white/10 bg-slate-900/75 p-2.5 text-[11px] text-white/90 backdrop-blur-md">
          <div className="font-bold text-yellow-300">Contrôles Battle Royale 3D :</div>
          <div>ZQSD / WASD : Courir · Espace : Sauter</div>
          <div>Souris : Viser en 3D · Clic gauche : Tirer 🔫</div>
          <div>Clic droit ou F : Construire Mur 3D 🧱 · R ou E : Rampe 3D 📐</div>
        </div>
      )}

      {/* Mobile Touch Controls */}
      {touch && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <Joystick onMove={(v) => (inputRef.current.move = v)} size={125} />
          <div className="flex items-end gap-2">
            <HoldButton
              label="🧱 Mur"
              className="h-14 w-14 rounded-2xl bg-amber-600/90 text-xs"
              onDown={() => (inputRef.current.buildWall = true)}
            />
            <HoldButton
              label="📐 Rampe"
              className="h-14 w-14 rounded-2xl bg-indigo-600/90 text-xs"
              onDown={() => (inputRef.current.buildRamp = true)}
            />
            <HoldButton
              label="⤒"
              className="h-14 w-14 bg-emerald-600/90 text-xl"
              onDown={() => (inputRef.current.jump = true)}
              onUp={() => (inputRef.current.jump = false)}
            />
            <HoldButton
              label="🔫"
              className="h-20 w-20 bg-red-600/90 text-3xl"
              onDown={() => (inputRef.current.fire = true)}
              onUp={() => (inputRef.current.fire = false)}
            />
          </div>
        </div>
      )}

      {/* Victory / End Screen */}
      {end && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-gradient-to-b from-indigo-700 to-slate-900 p-6 text-center text-white shadow-2xl">
            <div className="text-6xl">{end.win ? '👑' : '💀'}</div>
            <h2 className="mt-2 bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-3xl font-black text-transparent">
              {end.win ? '#1 VICTOIRE ROYALE 3D !' : `ÉLIMINÉ — #${end.place}`}
            </h2>
            <p className="mt-2 text-base font-bold text-white/85">
              🎯 {end.kills} élimination{end.kills > 1 ? 's' : ''} en 3D
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={restart}
                className="flex-1 rounded-2xl bg-yellow-400 py-3 font-black text-black shadow-lg hover:bg-yellow-300"
              >
                🔄 Rejouer
              </button>
              <button
                onClick={onExit}
                className="flex-1 rounded-2xl bg-white/15 py-3 font-bold text-white hover:bg-white/25"
              >
                Menu 3D
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
