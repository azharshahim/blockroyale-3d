import * as THREE from 'three';

export function createSky(sunDir: THREE.Vector3) {
  const uniforms = {
    topColor: { value: new THREE.Color(0x2b6fd6) },
    bottomColor: { value: new THREE.Color(0xcfe8ff) },
    sunColor: { value: new THREE.Color(0xfff3c4) },
    sunDir: { value: sunDir.clone().normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunColor; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(bottomColor, topColor, pow(h, 0.55));
        if (d.y < 0.0) col = bottomColor * 0.9;
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0) * 2.5 + pow(s, 12.0) * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return {
    mesh,
    set(top: number, bottom: number, sun: number) {
      uniforms.topColor.value.setHex(top);
      uniforms.bottomColor.value.setHex(bottom);
      uniforms.sunColor.value.setHex(sun);
    },
  };
}

/** Crossed-plane grass tuft geometry */
export function createGrassGeometry() {
  const g1 = new THREE.PlaneGeometry(0.7, 0.55);
  const g2 = g1.clone().rotateY(Math.PI / 2);
  g1.translate(0, 0.27, 0);
  g2.translate(0, 0.27, 0);
  const merged = new THREE.BufferGeometry();
  const pos = [...(g1.attributes.position.array as Float32Array), ...(g2.attributes.position.array as Float32Array)];
  const uv = [...(g1.attributes.uv.array as Float32Array), ...(g2.attributes.uv.array as Float32Array)];
  const idx1 = Array.from(g1.index!.array);
  const idx2 = Array.from(g2.index!.array).map((i) => i + 4);
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  merged.setIndex([...idx1, ...idx2]);
  merged.computeVertexNormals();
  return merged;
}

export function createGrassMaterial(color = 0x4fae3c) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 9; i++) {
    g.fillStyle = i % 2 ? '#5fc24a' : '#3f8f2f';
    const x = 2 + i * 3.3;
    g.fillRect(x, 8 + (i * 7) % 12, 2, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, color, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
}
