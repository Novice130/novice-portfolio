// Post chain for the high tier: ambient occlusion, bloom, then a grade pass
// that tone-maps lit pixels only and adds a touch of grain and vignette.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export type Pipeline = {
  render(): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  /** Grain animates only while the camera moves, so a settled view is a still image. */
  setMoving(moving: boolean): void;
  set(options: { gtao?: boolean; bloom?: boolean }): void;
  dispose(): void;
};

const GRADE_VERTEX = /* glsl */ `
  precision highp float;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// Raw shader, like three's OutputShader: a normal ShaderMaterial would have the
// renderer's own tone mapping injected a second time when drawing to the screen.
const GRADE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uContrast;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uSeed;
  #include <tonemapping_pars_fragment>
  #include <colorspace_pars_fragment>
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    // Alpha 1: lit surface, tone-mapped. Alpha 0: screenshot or label, shown as authored.
    float lit = clamp(texel.a, 0.0, 1.0);
    vec3 mapped = sRGBTransferOETF(vec4(ACESFilmicToneMapping(texel.rgb), 1.0)).rgb;
    mapped = clamp((mapped - 0.5) * uContrast + 0.5, 0.0, 1.0);
    vec3 plain = sRGBTransferOETF(vec4(clamp(texel.rgb, 0.0, 1.0), 1.0)).rgb;
    vec3 color = mix(plain, mapped, lit);
    color *= 1.0 - uVignette * smoothstep(0.45, 1.0, length(vUv - 0.5) * 1.4);
    color += (hash(gl_FragCoord.xy + uSeed) - 0.5) * uGrain;
    gl_FragColor = vec4(color, 1.0);
  }`;

class GradePass extends Pass {
  readonly uniforms = {
    tDiffuse: { value: null as THREE.Texture | null },
    toneMappingExposure: { value: 1 },
    uContrast: { value: 1.05 },
    uVignette: { value: 0.16 },
    uGrain: { value: 0.02 },
    uSeed: { value: 0 },
  };
  private readonly material = new THREE.RawShaderMaterial({
    name: 'GalleryGrade',
    uniforms: this.uniforms,
    vertexShader: GRADE_VERTEX,
    fragmentShader: GRADE_FRAGMENT,
  });
  private readonly quad = new FullScreenQuad(this.material);

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

export function createPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): Pipeline | null {
  // Without float colour buffers the half-float target is incomplete and renders black, silently.
  if (!renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) {
    return null;
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // The chain bypasses the canvas's own antialiasing, so the scene target is multisampled.
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
  gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: 12, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.85;
  // Half resolution: occlusion is low-frequency and the denoise pass hides the difference.
  const fullSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w: number, h: number) => fullSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
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
  composer.addPass(gtao);

  // Threshold above 1: only emitters (lamps, skylight, door glow) bloom, never a white web page.
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.6, 1.15);
  // Add light without touching alpha, which carries the lit / unlit mask.
  const blend = bloom.blendMaterial;
  blend.blending = THREE.CustomBlending;
  blend.blendEquation = THREE.AddEquation;
  blend.blendSrc = THREE.OneFactor;
  blend.blendDst = THREE.OneFactor;
  blend.blendSrcAlpha = THREE.ZeroFactor;
  blend.blendDstAlpha = THREE.OneFactor;
  composer.addPass(bloom);

  const grade = new GradePass();
  composer.addPass(grade);

  let moving = false;
  return {
    render() {
      if (moving) grade.uniforms.uSeed.value = (grade.uniforms.uSeed.value + 1.618) % 97;
      composer.render();
    },
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    setMoving(next) {
      moving = next;
    },
    set(options) {
      if (options.gtao !== undefined) gtao.enabled = options.gtao;
      if (options.bloom !== undefined) bloom.enabled = options.bloom;
    },
    dispose() {
      gtao.dispose();
      bloom.dispose();
      grade.dispose();
      composer.dispose();
      target.dispose();
    },
  };
}
