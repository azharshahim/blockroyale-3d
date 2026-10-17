import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createCharacter3D,
  SKINS,
  SkinId,
  updateCharacterAnimation,
} from '../games/Character3D';

export default function LobbyPreview3D({
  skinId,
  onSelectSkin,
}: {
  skinId: SkinId;
  onSelectSkin: (id: SkinId) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [animMode, setAnimMode] = useState<'idle' | 'run' | 'dance' | 'shoot' | 'mine'>('idle');
  const [toolMode, setToolMode] = useState<'gun' | 'pickaxe'>('gun');

  const animRef = useRef(animMode);
  animRef.current = animMode;

  useEffect(() => {
    const container = mountRef.current!;
    const w = container.clientWidth || 340;
    const h = container.clientHeight || 360;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 50);
    camera.position.set(0, 1.45, 3.8);
    camera.lookAt(0, 1.05, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Studio HD 3-Point Lighting
    const amb = new THREE.HemisphereLight(0xe0f2fe, 0x1e1b4b, 0.9);
    scene.add(amb);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 2.5, 10);
    rimLight.position.set(-2.5, 2.5, -2);
    scene.add(rimLight);

    // Holographic Pedestal
    const pedestalGroup = new THREE.Group();
    scene.add(pedestalGroup);

    const baseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.2, 0.14, 32),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.25,
        metalness: 0.8,
      })
    );
    baseDisc.position.y = -0.07;
    baseDisc.receiveShadow = true;
    pedestalGroup.add(baseDisc);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.06, 0.035, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.01;
    pedestalGroup.add(glowRing);

    // Create 3D Character with selected Skin & Tool
    const skinDef = SKINS.find((s) => s.id === skinId) || SKINS[0];
    const rig = createCharacter3D(skinDef, toolMode);
    rig.root.rotation.y = 0.3;
    scene.add(rig.root);

    // Interactive Drag Rotation
    let dragging = false;
    let lastX = 0;
    let userYaw = 0.35;

    const dom = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      userYaw += dx * 0.012;
    };
    const onUp = () => {
      dragging = false;
    };

    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth || 340;
      const nh = container.clientHeight || 360;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    let prev = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      if (!dragging) {
        userYaw += dt * 0.35;
      }
      rig.root.rotation.y = userYaw;
      glowRing.scale.setScalar(1 + Math.sin(now * 0.004) * 0.025);

      const mode = animRef.current;
      updateCharacterAnimation(rig, dt, {
        speed: mode === 'run' ? 0.95 : 0,
        onGround: true,
        dancing: mode === 'dance',
        shooting: mode === 'shoot',
        aiming: mode === 'shoot',
        mining: mode === 'mine',
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [skinId, toolMode]);

  const currentSkin = SKINS.find((s) => s.id === skinId) || SKINS[0];

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-indigo-400/30 bg-gradient-to-b from-indigo-950/80 via-slate-900/90 to-slate-950 p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <span className="inline-block rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-300">
            Casier 3D Temps Réel · Glisser pour tourner
          </span>
          <h3 className="mt-1 text-lg font-black text-white">{currentSkin.name}</h3>
          <p className="text-xs text-white/60">{currentSkin.subtitle}</p>
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setToolMode('gun');
              setAnimMode('shoot');
            }}
            className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
              toolMode === 'gun'
                ? 'bg-sky-500 text-black shadow'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            🔫 Fusil 3D
          </button>
          <button
            onClick={() => {
              setToolMode('pickaxe');
              setAnimMode('mine');
            }}
            className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
              toolMode === 'pickaxe'
                ? 'bg-emerald-400 text-black shadow'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            ⛏️ Pioche 3D
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div ref={mountRef} className="my-1 h-64 w-full cursor-grab active:cursor-grabbing sm:h-72" />

      {/* Animation Tester Buttons */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {(
          [
            ['idle', '🧍 Pose'],
            ['run', '🏃 Sprint'],
            ['dance', '💃 Danse'],
            ['shoot', '🔫 Tirer'],
            ['mine', '⛏️ Miner'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              if (id === 'mine') setToolMode('pickaxe');
              if (id === 'shoot') setToolMode('gun');
              setAnimMode(id);
            }}
            className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
              animMode === id
                ? 'bg-yellow-400 text-black shadow'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Skin Selector */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
        <span className="text-xs font-bold text-white/70">Tenue 3D :</span>
        <div className="flex flex-wrap gap-1.5">
          {SKINS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelectSkin(s.id)}
              className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                skinId === s.id
                  ? 'ring-2 ring-white bg-indigo-600 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {s.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
