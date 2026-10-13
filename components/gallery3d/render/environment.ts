// Room reflections. The gallery is rendered into two cube maps (one standing in
// the corridor, one in the salon), each prefiltered for rough surfaces, and
// handed to the materials of that zone. Reflections therefore show this room.
// Bakes happen on demand (load, theme switch, late textures), never per frame.
import * as THREE from 'three';
import { CORRIDOR, SALON } from '../contract';

export type Zone = 'corridor' | 'salon';

export type RegisterOptions = {
  /** envMapIntensity once the map is assigned (default 1). */
  intensity?: number;
  /** Applied only once a bake has succeeded, so a failed bake leaves the old look. */
  metalness?: number;
  roughness?: number;
};

export type Environment = {
  bake(): void;
  register(material: THREE.MeshStandardMaterial, zone: Zone, options?: RegisterOptions): void;
  /** Unfiltered cube map for custom shaders; null until the first bake. */
  cube(zone: Zone): THREE.CubeTexture | null;
  onBake(listener: () => void): void;
  dispose(): void;
};

const PROBE: Record<Zone, [number, number, number]> = {
  corridor: [0, 2.4, (CORRIDOR.zStart + CORRIDOR.zEnd) / 2],
  // Off the salon centre: the centre is inside the glass case.
  salon: [SALON.center[0] + 3.5, 3.2, SALON.center[2] + 3.5],
};
const FACE = 256;

type Entry = { material: THREE.MeshStandardMaterial; options: RegisterOptions };
type ZoneState = {
  target: THREE.WebGLCubeRenderTarget;
  camera: THREE.CubeCamera;
  filtered: THREE.WebGLRenderTarget | null;
  entries: Entry[];
};

export function createEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  hidden: () => THREE.Object3D[],
): Environment {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const listeners: Array<() => void> = [];
  let baked = false;

  const makeZone = (zone: Zone): ZoneState => {
    const target = new THREE.WebGLCubeRenderTarget(FACE, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    const camera = new THREE.CubeCamera(0.1, 80, target);
    camera.position.set(...PROBE[zone]);
    return { target, camera, filtered: null, entries: [] };
  };
  const zones: Record<Zone, ZoneState> = { corridor: makeZone('corridor'), salon: makeZone('salon') };
  const all = () => [...zones.corridor.entries, ...zones.salon.entries];

  const assign = (state: ZoneState, entry: Entry) => {
    if (!state.filtered) return;
    const { material, options } = entry;
    const first = !material.envMap;
    material.envMap = state.filtered.texture;
    material.envMapIntensity = options.intensity ?? 1;
    if (first) {
      if (options.metalness !== undefined) material.metalness = options.metalness;
      if (options.roughness !== undefined) material.roughness = options.roughness;
      material.needsUpdate = true;
    }
  };

  return {
    bake() {
      const hide = hidden().filter((o) => o.visible);
      hide.forEach((o) => (o.visible = false));
      // No feedback loop: nothing reflects while the probes render. Intensity
      // 0, not a null map, so no shader recompiles.
      all().forEach((e) => (e.material.envMapIntensity = 0));
      try {
        for (const state of Object.values(zones)) {
          state.camera.update(renderer, scene);
          const next = pmrem.fromCubemap(state.target.texture);
          state.filtered?.dispose();
          state.filtered = next;
        }
        baked = true;
      } finally {
        hide.forEach((o) => (o.visible = true));
        for (const state of Object.values(zones)) state.entries.forEach((e) => assign(state, e));
      }
      listeners.forEach((fn) => fn());
    },
    register(material, zone, options = {}) {
      const entry = { material, options };
      zones[zone].entries.push(entry);
      if (baked) assign(zones[zone], entry);
    },
    cube: (zone) => (baked ? zones[zone].target.texture : null),
    onBake(listener) {
      listeners.push(listener);
    },
    dispose() {
      for (const state of Object.values(zones)) {
        state.entries.forEach((e) => (e.material.envMap = null));
        state.entries.length = 0;
        state.filtered?.dispose();
        state.target.dispose();
      }
      pmrem.dispose();
      listeners.length = 0;
    },
  };
}
