// Post step for the high tier. The scene is drawn straight to the canvas, as on
// the low tier, so colours, blending and antialiasing are identical. Ambient
// occlusion is then computed from a separate depth and normal pass and
// multiplied over the finished image, together with a vignette and a touch of
// grain, in one full-screen draw.
//
// The scene is deliberately not rendered into an off-screen linear target: the
// glow planes, light pools and decals are authored for blending in display
// space, and in linear light the additive ones wash out dark surfaces.
import * as THREE from 'three';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export type Pipeline = {
  render(): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  /** Grain animates only while the camera moves, so a settled view is a still image. */
  setMoving(moving: boolean): void;
  set(options: { gtao?: boolean; grade?: boolean }): void;
  dispose(): void;
};

const OVERLAY_VERTEX = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

// Drawn with blending "2 * source * destination": 0.5 leaves the image as it
// is, less darkens, more brightens. That lets one draw carry occlusion and the
// vignette (both darken) and the grain (either way).
const OVERLAY_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tAo;
  uniform float uAo;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uSeed;
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  void main() {
    float gain = mix(1.0, texture2D(tAo, vUv).r, uAo);
    gain *= 1.0 - uVignette * smoothstep(0.45, 1.0, length(vUv - 0.5) * 1.4);
    gain += (hash(gl_FragCoord.xy + uSeed) - 0.5) * uGrain;
    gl_FragColor = vec4(vec3(0.5 * gain), 1.0);
  }`;

const AO_INTENSITY = 0.7;
const VIGNETTE = 0.16;
const GRAIN = 0.02;

export function createPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): Pipeline | null {
  // GTAOPass keeps normals in a half-float target; without float colour buffers it is incomplete.
  if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) {
    return null;
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // Full resolution: at half size the occlusion beside a pilaster or frame edge
  // lands a pixel off the edge and reads as a ragged dark fringe.
  const whole = (n: number) => Math.max(1, Math.floor(n));
  const gtao = new GTAOPass(scene, camera, whole(size.x), whole(size.y));
  gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: 12, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  // Compute only; the overlay below does the compositing.
  gtao.output = GTAOPass.OUTPUT.Off;
  // GTAOPass renders the scene again with a normal material. Glow planes, glass,
  // floor markers and hit targets must not occlude: hide everything that is not
  // an opaque surface for that pass.
  const hiddenForAo = new Map<THREE.Object3D, boolean>();
  const soft = (o: THREE.Object3D): boolean => {
    const mesh = o as THREE.Mesh;
    if ((o as THREE.Points).isPoints || (o as THREE.Line).isLine) return true;
    if (!mesh.isMesh) return false;
    const m = mesh.material as THREE.Material | THREE.Material[];
    const one = Array.isArray(m) ? m[0] : m;
    return !!one && (one.transparent || !one.visible || !one.depthWrite);
  };
  gtao.overrideVisibility = () => {
    scene.traverse((o) => {
      if (soft(o)) {
        hiddenForAo.set(o, o.visible);
        o.visible = false;
      }
    });
  };
  gtao.restoreVisibility = () => {
    hiddenForAo.forEach((visible, o) => (o.visible = visible));
    hiddenForAo.clear();
  };

  const uniforms = {
    tAo: { value: gtao.pdRenderTarget.texture as THREE.Texture },
    uAo: { value: AO_INTENSITY },
    uVignette: { value: VIGNETTE },
    uGrain: { value: GRAIN },
    uSeed: { value: 0 },
  };
  const overlayMaterial = new THREE.RawShaderMaterial({
    name: 'GalleryOverlay',
    uniforms,
    vertexShader: OVERLAY_VERTEX,
    fragmentShader: OVERLAY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.SrcColorFactor,
  });
  const overlay = new FullScreenQuad(overlayMaterial);

  let moving = false;
  let ao = true;
  let grade = true;
  return {
    render() {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      if (!ao && !grade) return;
      // Output is off, so the pass touches neither buffer.
      if (ao) gtao.render(renderer, null as never, null as never, 0, false);
      if (moving) uniforms.uSeed.value = (uniforms.uSeed.value + 1.618) % 97;
      uniforms.uAo.value = ao ? AO_INTENSITY : 0;
      uniforms.uVignette.value = grade ? VIGNETTE : 0;
      uniforms.uGrain.value = grade ? GRAIN : 0;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(null);
      overlay.render(renderer);
      renderer.autoClear = autoClear;
    },
    setSize(width, height, pixelRatio) {
      gtao.setSize(whole(width * pixelRatio), whole(height * pixelRatio));
    },
    setMoving(next) {
      moving = next;
    },
    set(options) {
      if (options.gtao !== undefined) ao = options.gtao;
      if (options.grade !== undefined) grade = options.grade;
    },
    dispose() {
      gtao.dispose();
      overlayMaterial.dispose();
      overlay.dispose();
    },
  };
}
