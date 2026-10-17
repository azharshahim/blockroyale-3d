import * as THREE from 'three';

const cache: Record<string, THREE.CanvasTexture> = {};

function createCanvasTex(key: string, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat = 1): THREE.CanvasTexture {
  const cacheKey = `${key}_${repeat}`;
  if (cache[cacheKey]) return cache[cacheKey];
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeat > 1) {
    tex.repeat.set(repeat, repeat);
  }
  tex.needsUpdate = true;
  cache[cacheKey] = tex;
  return tex;
}

const matCache: Record<number, THREE.Material | THREE.Material[]> = {};
export function getBlockMaterials(blockId: number): THREE.Material | THREE.Material[] {
  if (!matCache[blockId]) matCache[blockId] = buildBlockMaterials(blockId);
  return matCache[blockId];
}

function buildBlockMaterials(blockId: number): THREE.Material | THREE.Material[] {
  switch (blockId) {
    case 1: {
      // Grass Block (Top, Bottom, Sides)
      const top = createCanvasTex('grass_top', (ctx, s) => {
        ctx.fillStyle = '#3da34d';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#4dbd5e' : '#2e853c';
          ctx.fillRect((i * 37) % s, (i * 53) % s, 6, 6);
        }
      });
      const bottom = createCanvasTex('dirt', drawDirt);
      const side = createCanvasTex('grass_side', (ctx, s) => {
        drawDirt(ctx, s);
        ctx.fillStyle = '#3da34d';
        ctx.fillRect(0, 0, s, s * 0.28);
        for (let x = 0; x < s; x += 8) {
          const h = 18 + ((x * 13) % 22);
          ctx.fillStyle = '#4dbd5e';
          ctx.fillRect(x, 0, 8, h);
        }
      });
      const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.85 });
      const topMat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.8 });
      const botMat = new THREE.MeshStandardMaterial({ map: bottom, roughness: 0.9 });
      return [sideMat, sideMat, topMat, botMat, sideMat, sideMat];
    }
    case 2: // Dirt
      return new THREE.MeshStandardMaterial({
        map: createCanvasTex('dirt', drawDirt),
        roughness: 0.9,
      });
    case 3: // Stone
      return new THREE.MeshStandardMaterial({
        map: createCanvasTex('stone', drawStone),
        roughness: 0.75,
        metalness: 0.08,
      });
    case 4: // Wood Log
      return new THREE.MeshStandardMaterial({
        map: createCanvasTex('wood', (ctx, s) => {
          ctx.fillStyle = '#734b26';
          ctx.fillRect(0, 0, s, s);
          for (let x = 0; x < s; x += 12) {
            ctx.fillStyle = x % 24 === 0 ? '#5c3a1b' : '#875930';
            ctx.fillRect(x, 0, 8, s);
          }
        }),
        roughness: 0.8,
      });
    case 5: // Leaves
      return new THREE.MeshStandardMaterial({
        map: createCanvasTex('leaves', (ctx, s) => {
          ctx.fillStyle = '#246e32';
          ctx.fillRect(0, 0, s, s);
          for (let i = 0; i < 300; i++) {
            ctx.fillStyle = i % 3 === 0 ? '#349646' : '#1a5224';
            ctx.fillRect((i * 29) % s, (i * 43) % s, 8, 8);
          }
        }),
        roughness: 0.85,
      });
    case 6: // Sand
      return new THREE.MeshStandardMaterial({
        map: createCanvasTex('sand', (ctx, s) => {
          ctx.fillStyle = '#e5cf87';
          ctx.fillRect(0, 0, s, s);
          for (let i = 0; i < 350; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#f0de9e' : '#cfb86e';
            ctx.fillRect((i * 31) % s, (i * 61) % s, 5, 5);
          }
        }),
        roughness: 0.85,
      });
    case 7: // Planks
      return new THREE.MeshStandardMaterial({
        map: createCanvasTex('planks', (ctx, s) => {
          ctx.fillStyle = '#c49352';
          ctx.fillRect(0, 0, s, s);
          ctx.fillStyle = '#8f6531';
          for (let y = 0; y < s; y += 32) {
            ctx.fillRect(0, y, s, 3);
            ctx.fillRect(((y * 3) % s), y, 3, 32);
          }
        }),
        roughness: 0.7,
      });
    case 8: // Diamond Ore
      return new THREE.MeshStandardMaterial({
        map: createCanvasTex('diamond', (ctx, s) => {
          drawStone(ctx, s);
          ctx.fillStyle = '#38f8ff';
          const spots = [
            [24, 28], [76, 22], [48, 64], [22, 88], [86, 78], [60, 40],
          ];
          for (const [x, y] of spots) {
            ctx.fillRect(x, y, 16, 14);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + 3, y + 3, 5, 5);
            ctx.fillStyle = '#38f8ff';
          }
        }),
        roughness: 0.4,
        metalness: 0.35,
      });
    case 11: // Bricks
      return new THREE.MeshStandardMaterial({
        map: createCanvasTex('bricks', (ctx, s) => {
          ctx.fillStyle = '#b5483a';
          ctx.fillRect(0, 0, s, s);
          ctx.fillStyle = '#d6cfc4';
          for (let y = 0; y < s; y += 24) {
            ctx.fillRect(0, y, s, 4);
            const off = (y / 24) % 2 === 0 ? 0 : 24;
            for (let x = off; x < s; x += 48) {
              ctx.fillRect(x, y, 4, 24);
            }
          }
        }),
        roughness: 0.75,
      });
    case 12: // Glass
      return new THREE.MeshStandardMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.48,
        roughness: 0.1,
        metalness: 0.2,
      });
    case 13: // Gold Block / Ore
      return new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.25,
        metalness: 0.8,
      });
    default:
      return new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.7 });
  }
}

function drawDirt(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = '#7c4f28';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 350; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#69411f' : '#8f5d32';
    ctx.fillRect((i * 41) % s, (i * 67) % s, 6, 6);
  }
}

function drawStone(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = '#7d828a';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 350; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#696e75' : '#9197a1';
    ctx.fillRect((i * 37) % s, (i * 59) % s, 8, 6);
  }
}

export function getBattleGroundTexture(): THREE.CanvasTexture {
  return createCanvasTex(
    'battle_ground_hd',
    (ctx, s) => {
      ctx.fillStyle = '#2f7d38';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#398e43' : '#26692e';
        ctx.fillRect((i * 29) % s, (i * 47) % s, 6, 6);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, s, s);
    },
    75
  );
}
