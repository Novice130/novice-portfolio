// Marks a built-in material as "unlit content": a screenshot, a label, a sign.
// It writes alpha 0, which the post chain's grade pass reads as "do not tone
// map". Harmless without the post chain: the canvas has no alpha channel.
import type * as THREE from 'three';

export function markUnlit<M extends THREE.Material>(material: M): M {
  const before = material.onBeforeCompile;
  const beforeKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\n\tgl_FragColor.a = 0.0;',
    );
  };
  material.customProgramCacheKey = () => `${beforeKey.call(material)}|unlit`;
  return material;
}
