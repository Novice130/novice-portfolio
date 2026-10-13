// Scanned PBR texture sets (colour, normal, roughness) for the room's surfaces.
// Sets load after first paint; a surface keeps its procedural texture until its
// set arrives, and for good if the set cannot be fetched.
import * as THREE from 'three';
import type { Quality } from '../contract';

export type SetName = 'parquet' | 'marble' | 'plaster' | 'velvet' | 'walnut';

export type ApplyOptions = {
  /** Texture repeats per unit of the surface's existing UVs. */
  repeat: [number, number];
  /** Keep the material's own colour map (a painted pattern); add only normal and roughness. */
  keepMap?: boolean;
  /** Tint applied when the scanned colour map replaces the painted one. */
  color?: number;
  /** Multiplier on the scanned roughness (default 1). */
  roughness?: number;
  normalScale?: number;
};

export type MaterialLibrary = {
  apply(material: THREE.MeshStandardMaterial, name: SetName, options: ApplyOptions): void;
  dispose(): void;
};

type Loaded = { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture };
const MAPS = ['color', 'normal', 'rough'] as const;

export function createMaterialLibrary(
  renderer: THREE.WebGLRenderer,
  quality: Quality,
  onChange: () => void,
): MaterialLibrary {
  const tier = quality === 'high' ? 'hi' : 'lo';
  const anisotropy = Math.min(quality === 'high' ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();
  const sets = new Map<SetName, Promise<Loaded | null>>();
  const owned: THREE.Texture[] = [];
  let disposed = false;

  const loadMap = (name: SetName, map: (typeof MAPS)[number]) =>
    new Promise<THREE.Texture>((resolve, reject) =>
      loader.load(`/gallery/tex/${name}/${map}-${tier}.webp`, resolve, undefined, reject),
    );

  const load = (name: SetName): Promise<Loaded | null> => {
    const cached = sets.get(name);
    if (cached) return cached;
    const pending = Promise.allSettled(MAPS.map((map) => loadMap(name, map))).then((results) => {
      const textures = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
      if (disposed || textures.some((t) => !t)) {
        textures.forEach((t) => t?.dispose());
        if (!disposed) console.warn(`[gallery3d] texture set "${name}" unavailable; keeping the procedural surface`);
        return null;
      }
      const [color, normal, rough] = textures as THREE.Texture[];
      color.colorSpace = THREE.SRGBColorSpace;
      owned.push(color, normal, rough);
      return { color, normal, rough };
    });
    sets.set(name, pending);
    return pending;
  };

  // Clones share the GPU image; each carries its own repeat.
  const tuned = (source: THREE.Texture, repeat: [number, number]): THREE.Texture => {
    const t = source.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
    owned.push(t);
    return t;
  };

  return {
    apply(material, name, options) {
      void load(name).then((set) => {
        if (!set || disposed) return;
        if (!options.keepMap) {
          material.map = tuned(set.color, options.repeat);
          if (options.color !== undefined) material.color.setHex(options.color);
        }
        material.normalMap = tuned(set.normal, options.repeat);
        material.normalScale.setScalar(options.normalScale ?? 1);
        material.roughnessMap = tuned(set.rough, options.repeat);
        material.roughness = options.roughness ?? 1;
        material.needsUpdate = true;
        onChange();
      });
    },
    dispose() {
      disposed = true;
      owned.forEach((t) => t.dispose());
      owned.length = 0;
      sets.clear();
    },
  };
}
