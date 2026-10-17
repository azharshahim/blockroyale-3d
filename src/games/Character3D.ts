import * as THREE from 'three';

export type SkinId = 'cyber' | 'crimson' | 'midas' | 'ranger' | 'ninja';

export interface SkinDef {
  id: SkinId;
  name: string;
  subtitle: string;
  primary: number;
  secondary: number;
  armor: number;
  visor: number;
  skinTone: number;
  hair: number;
  metalness?: number;
}

export const SKINS: SkinDef[] = [
  {
    id: 'cyber',
    name: 'Cyber Striker',
    subtitle: 'Armure Néo-Bleue & Visière LED',
    primary: 0x2563eb,
    secondary: 0x0f172a,
    armor: 0x1e293b,
    visor: 0x38bdf8,
    skinTone: 0xe6b89c,
    hair: 0x1e293b,
    metalness: 0.45,
  },
  {
    id: 'crimson',
    name: 'Crimson Ops',
    subtitle: 'Commando Écarlate',
    primary: 0xdc2626,
    secondary: 0x18181b,
    armor: 0x27272a,
    visor: 0xfacc15,
    skinTone: 0xd9a17c,
    hair: 0x27272a,
    metalness: 0.4,
  },
  {
    id: 'midas',
    name: 'Agent Or',
    subtitle: 'Édition Légendaire Dorée',
    primary: 0xf59e0b,
    secondary: 0x1c1917,
    armor: 0xfbbf24,
    visor: 0xffffff,
    skinTone: 0xe8c39e,
    hair: 0xfde047,
    metalness: 0.85,
  },
  {
    id: 'ranger',
    name: 'Voxel Ranger',
    subtitle: 'Explorateur Émeraude',
    primary: 0x10b981,
    secondary: 0x1e3a2f,
    armor: 0x065f46,
    visor: 0x6ee7b7,
    skinTone: 0xc9936b,
    hair: 0x451a03,
    metalness: 0.25,
  },
  {
    id: 'ninja',
    name: 'Shadow Wraith',
    subtitle: 'Ninja Cyber-Violet',
    primary: 0x7c3aed,
    secondary: 0x09090b,
    armor: 0x18181b,
    visor: 0xe879f9,
    skinTone: 0xe2b49a,
    hair: 0x09090b,
    metalness: 0.55,
  },
];

export interface CharacterRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  gunGroup: THREE.Group;
  pickaxeGroup: THREE.Group;
  muzzleFlash: THREE.Mesh;
  animTime: number;
  swingTime: number;
  recoilTime: number;
  hitFlashTime: number;
}

export function createCharacter3D(
  skin: SkinDef = SKINS[0],
  tool: 'gun' | 'pickaxe' | 'both' = 'gun'
): CharacterRig {
  const root = new THREE.Group();

  const matPrimary = new THREE.MeshStandardMaterial({
    color: skin.primary,
    roughness: 0.35,
    metalness: skin.metalness ?? 0.35,
  });
  const matSecondary = new THREE.MeshStandardMaterial({
    color: skin.secondary,
    roughness: 0.55,
    metalness: 0.25,
  });
  const matArmor = new THREE.MeshStandardMaterial({
    color: skin.armor,
    roughness: 0.3,
    metalness: skin.metalness ?? 0.5,
  });
  const matSkin = new THREE.MeshStandardMaterial({
    color: skin.skinTone,
    roughness: 0.65,
    metalness: 0.05,
  });
  const matVisor = new THREE.MeshStandardMaterial({
    color: skin.visor,
    emissive: skin.visor,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.8,
  });
  const matHair = new THREE.MeshStandardMaterial({
    color: skin.hair,
    roughness: 0.7,
  });

  // Hips / Pelvis root (height ~1.05m from ground)
  const hips = new THREE.Group();
  hips.position.y = 1.02;
  root.add(hips);

  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), matSecondary);
  pelvisMesh.castShadow = true;
  hips.add(pelvisMesh);

  // Tactical belt + buckle
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.09, 0.33), matArmor);
  belt.position.y = 0.05;
  hips.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.35), matVisor);
  buckle.position.y = 0.05;
  hips.add(buckle);

  // Torso group
  const torso = new THREE.Group();
  torso.position.y = 0.12;
  hips.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), matPrimary);
  chest.position.y = 0.33;
  chest.castShadow = true;
  chest.receiveShadow = true;
  torso.add(chest);

  // Armored chestplate + glowing core
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.44, 0.36), matArmor);
  vest.position.y = 0.38;
  vest.castShadow = true;
  torso.add(vest);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), matVisor);
  core.position.set(0, 0.4, 0.19);
  torso.add(core);

  // Tactical Backpack
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.2), matArmor);
  backpack.position.set(0, 0.36, -0.24);
  backpack.castShadow = true;
  torso.add(backpack);

  const packGlow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.04), matVisor);
  packGlow.position.set(0, 0.36, -0.35);
  torso.add(packGlow);

  // Neck & Head
  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 10), matSkin);
  neck.position.y = 0.04;
  head.add(neck);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), matSkin);
  skull.position.y = 0.28;
  skull.castShadow = true;
  head.add(skull);

  // Stylish Helmet / Hair crest
  const helmetTop = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.48), matHair);
  helmetTop.position.set(0, 0.46, -0.01);
  helmetTop.castShadow = true;
  head.add(helmetTop);

  const sideGuards = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.26), matArmor);
  sideGuards.position.set(0, 0.28, -0.06);
  head.add(sideGuards);

  // Glowing Tactical Visor / Eyes
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.06), matVisor);
  visor.position.set(0, 0.3, 0.21);
  head.add(visor);

  // Shoulder pads + Articulated Arms (Shoulder -> UpperArm -> Elbow -> Forearm + Hand)
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.38, 0.6, 0);
    torso.add(shoulder);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.28), matArmor);
    pad.position.set(side * 0.04, 0.02, 0);
    pad.castShadow = true;
    shoulder.add(pad);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.18), matPrimary);
    upperArm.position.y = -0.17;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.16), matSkin);
    forearm.position.y = -0.16;
    forearm.castShadow = true;
    elbow.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.18), matArmor);
    glove.position.y = -0.32;
    elbow.add(glove);

    return { shoulder, elbow };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // 3D Assault Rifle mounted on Right Hand
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0, -0.32, 0.12);
  rightArm.elbow.add(gunGroup);

  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
  const gunAccent = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.62), gunMat);
  receiver.position.set(0, 0.04, 0.22);
  receiver.castShadow = true;
  gunGroup.add(receiver);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.38, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.07, 0.65);
  gunGroup.add(barrel);

  const scope = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.22), gunAccent);
  scope.position.set(0, 0.15, 0.2);
  gunGroup.add(scope);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.12), gunMat);
  mag.position.set(0, -0.1, 0.28);
  mag.rotation.x = 0.25;
  gunGroup.add(mag);

  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.35, 6),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.9 })
  );
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.position.set(0, 0.07, 0.92);
  muzzleFlash.visible = false;
  gunGroup.add(muzzleFlash);

  // 3D Diamond Pickaxe mounted on Right Hand
  const pickaxeGroup = new THREE.Group();
  pickaxeGroup.position.set(0, -0.32, 0.08);
  rightArm.elbow.add(pickaxeGroup);

  const handleMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.8 });
  const diamondMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x0891b2,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.7,
  });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.75, 8), handleMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0, 0.28);
  pickaxeGroup.add(handle);

  const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.12), diamondMat);
  pickHead.position.set(0, 0, 0.6);
  pickHead.castShadow = true;
  pickaxeGroup.add(pickHead);

  // Barrel follows the arm axis, scope/magazine stay on top (was pointing at the sky)
  gunGroup.rotation.x = Math.PI / 2;
  pickaxeGroup.rotation.x = Math.PI / 2;

  gunGroup.visible = tool === 'gun' || tool === 'both';
  pickaxeGroup.visible = tool === 'pickaxe';

  // Articulated Legs (Hip -> Thigh -> Knee -> Shin -> Boot)
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.15, -0.05, 0);
    hips.add(hip);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.44, 0.22), matSecondary);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    hip.add(thigh);

    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.12, 0.25), matArmor);
    kneePad.position.set(0, -0.42, 0.02);
    hip.add(kneePad);

    const knee = new THREE.Group();
    knee.position.y = -0.44;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.42, 0.2), matPrimary);
    shin.position.y = -0.21;
    shin.castShadow = true;
    knee.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.32), matArmor);
    boot.position.set(0, -0.45, 0.05);
    boot.castShadow = true;
    knee.add(boot);

    return { hip, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  return {
    root,
    hips,
    torso,
    head,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    gunGroup,
    pickaxeGroup,
    muzzleFlash,
    animTime: Math.random() * 10,
    swingTime: 0,
    recoilTime: 0,
    hitFlashTime: 0,
  };
}

export function updateCharacterAnimation(
  rig: CharacterRig,
  dt: number,
  state: {
    speed: number; // 0..1 normalized movement speed
    onGround: boolean;
    aiming?: boolean;
    shooting?: boolean;
    mining?: boolean;
    dancing?: boolean;
    aimPitch?: number;
  }
) {
  rig.animTime += dt * (state.speed > 0.05 ? 9 + state.speed * 5 : 2.5);
  const t = rig.animTime;

  if (state.shooting) {
    rig.recoilTime = 0.14;
  }
  if (rig.recoilTime > 0) {
    rig.recoilTime = Math.max(0, rig.recoilTime - dt);
    rig.muzzleFlash.visible = rig.recoilTime > 0.07;
    rig.muzzleFlash.rotation.z += 1.5;
  } else {
    rig.muzzleFlash.visible = false;
  }

  if (state.mining) {
    rig.swingTime = Math.min(1, rig.swingTime + dt * 12);
  } else {
    rig.swingTime = Math.max(0, rig.swingTime - dt * 6);
  }

  // Dance mode (for Lobby / Victory!)
  if (state.dancing) {
    const beat = Math.sin(t * 2.2);
    rig.hips.position.y = 1.02 + Math.abs(beat) * 0.12;
    rig.hips.rotation.y = Math.sin(t * 1.1) * 0.35;
    rig.torso.rotation.z = Math.cos(t * 2.2) * 0.18;
    rig.head.rotation.y = Math.sin(t * 2.2) * 0.25;
    rig.leftShoulder.rotation.x = -1.2 + Math.sin(t * 2.2) * 0.7;
    rig.leftShoulder.rotation.z = 0.4;
    rig.leftElbow.rotation.x = -0.8;
    rig.rightShoulder.rotation.x = -1.2 - Math.sin(t * 2.2) * 0.7;
    rig.rightShoulder.rotation.z = -0.4;
    rig.rightElbow.rotation.x = -0.8;
    rig.leftHip.rotation.x = Math.sin(t * 2.2) * 0.45;
    rig.leftKnee.rotation.x = Math.max(0, -Math.sin(t * 2.2) * 0.8);
    rig.rightHip.rotation.x = -Math.sin(t * 2.2) * 0.45;
    rig.rightKnee.rotation.x = Math.max(0, Math.sin(t * 2.2) * 0.8);
    return;
  }

  const spd = Math.min(1, state.speed);

  // Legs & Hips animation
  if (!state.onGround) {
    // Airborne jump pose
    rig.hips.position.y = 1.05;
    rig.leftHip.rotation.x = -0.45;
    rig.leftKnee.rotation.x = 0.75;
    rig.rightHip.rotation.x = 0.25;
    rig.rightKnee.rotation.x = 0.45;
    rig.torso.rotation.x = 0.12;
  } else if (spd > 0.05) {
    // Dynamic Run Cycle with realistic knee articulation
    const stride = Math.sin(t) * 0.85 * spd;
    const bounce = Math.abs(Math.cos(t)) * 0.09 * spd;
    rig.hips.position.y = 1.02 + bounce;
    rig.hips.rotation.y = Math.sin(t) * 0.1 * spd;
    rig.torso.rotation.x = 0.14 * spd;
    rig.torso.rotation.y = -Math.sin(t) * 0.14 * spd;

    rig.leftHip.rotation.x = stride;
    rig.leftKnee.rotation.x = Math.max(0, -Math.cos(t) * 1.15 * spd);

    rig.rightHip.rotation.x = -stride;
    rig.rightKnee.rotation.x = Math.max(0, Math.cos(t) * 1.15 * spd);
  } else {
    // Idle breathing stance
    const breath = Math.sin(t) * 0.025;
    rig.hips.position.y = 1.02 + breath * 0.5;
    rig.hips.rotation.y = 0;
    rig.torso.rotation.x = breath;
    rig.torso.rotation.y = Math.sin(t * 0.5) * 0.06;
    rig.leftHip.rotation.x = 0.05;
    rig.leftKnee.rotation.x = 0.08;
    rig.rightHip.rotation.x = -0.05;
    rig.rightKnee.rotation.x = 0.08;
  }

  // Head pitch & look
  const pitch = state.aimPitch ?? 0;
  rig.head.rotation.x = pitch * 0.6;
  rig.head.rotation.y = -rig.torso.rotation.y * 0.5;

  // Arms animation
  if (state.aiming || state.shooting || rig.recoilTime > 0) {
    // Tactical Two-Handed Rifle Aim + Recoil
    const kick = rig.recoilTime > 0 ? Math.sin(rig.recoilTime * 45) * 0.1 : 0;
    // shoulder+elbow = -90deg - pitch  =>  the rifle points exactly where the player looks
    const aimX = -Math.PI / 2 + 0.12 - pitch * 0.95 - kick;
    rig.rightShoulder.rotation.set(aimX, -0.12, 0);
    rig.rightElbow.rotation.set(-0.12, 0, 0);
    rig.leftShoulder.rotation.set(aimX + 0.04, 0.62, 0);
    rig.leftElbow.rotation.set(-0.42, 0, 0);
  } else if (rig.swingTime > 0) {
    // Dynamic Pickaxe / Build Swing
    const sw = Math.sin(rig.animTime * 4.5);
    rig.rightShoulder.rotation.set(-1.6 + sw * 1.1, 0, -0.1);
    rig.rightElbow.rotation.set(-0.5 + sw * 0.4, 0, 0);
    rig.leftShoulder.rotation.set(Math.sin(t) * 0.5 * spd, 0, 0.12);
    rig.leftElbow.rotation.set(-0.3, 0, 0);
  } else {
    // Natural arm swing while running / idle
    const armSwing = Math.sin(t) * 0.7 * spd;
    rig.leftShoulder.rotation.set(-armSwing, 0, 0.08);
    rig.leftElbow.rotation.set(-0.35 - Math.max(0, -armSwing * 0.4), 0, 0);

    rig.rightShoulder.rotation.set(armSwing - 0.25, 0, -0.08);
    rig.rightElbow.rotation.set(-0.55, 0, 0);
  }
}
