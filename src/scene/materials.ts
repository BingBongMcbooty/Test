import { useMemo } from 'react'
import { Color, DoubleSide, ShaderMaterial, Timer, Vector3 } from 'three'
import type { Stage } from '../state/stageConfig'

// Animates `uTime` via the material's own `onBeforeRender` (three.js calls this right
// before drawing the mesh) rather than a `useFrame` callback mutating the memoized
// material from outside — eslint-plugin-react-hooks' compiler-based checks treat a
// value returned from one hook (`useMemo`) as frozen once it's mutated inside another
// hook's callback. Setting `onBeforeRender` here, during the material's own
// construction, sidesteps that: the mutation happens inside a plain three.js callback,
// not across a hook boundary.
function withTimeUniform(material: ShaderMaterial): ShaderMaterial {
  const timer = new Timer()
  material.onBeforeRender = () => {
    timer.update()
    material.uniforms.uTime.value = timer.getElapsed()
  }
  return material
}

/**
 * Shared shader/material system driving the Stage 1→2→3 visual escalation: line stays
 * untouched wireframe, plane gets a first faint hint of a lit/animated fill behind its
 * wireframe, cube gets the full procedural treatment. Both fills are hand-rolled
 * ShaderMaterials (not lit by real scene lights) so the "multi-light" look and the
 * noise/fresnel detail live in one place; `LIGHT_RIG` below is the single source of
 * truth shared with the real `<directionalLight>`s in `Experience.tsx` so the two stay
 * numerically consistent even though the shader can't read the scene lights directly.
 */

export const LIGHT_RIG = {
  ambient: { color: '#c9c9ff', intensity: 0.35 },
  key: { position: [4, 6, 5] as [number, number, number], color: '#ffffff', intensity: 1.15 },
  fill: {
    position: [-5, -3, -4] as [number, number, number],
    color: '#7fa8ff',
    intensity: 0.55,
  },
}

function lightDirection(position: [number, number, number]) {
  return new Vector3(...position).normalize()
}

// Procedural hash/value-noise + a 3-octave fbm — no image textures, per PLAN.md's note
// that this repo has no texture-asset pipeline yet.
const noiseGLSL = /* glsl */ `
  float hash13(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 2; i++) {
      value += amplitude * noise3(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
`

const richnessVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

// Cube stage (Task 7): multi-light (ambient + key + fill) Lambert term, animated fbm
// tinting between base/rim colors, and a fresnel rim glow that boosts both brightness
// and opacity at grazing angles — kept translucent/double-sided/no-depth-write so the
// far side of the cube and a mid-drag arrow stay legible from any orbit angle.
const cubeFragmentShader = /* glsl */ `
  ${noiseGLSL}

  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uBaseColor;
  uniform vec3 uRimColor;
  uniform float uNoiseStrength;
  uniform vec3 uAmbientColor;
  uniform float uAmbientIntensity;
  uniform vec3 uLight1Dir;
  uniform vec3 uLight1Color;
  uniform float uLight1Intensity;
  uniform vec3 uLight2Dir;
  uniform vec3 uLight2Color;
  uniform float uLight2Intensity;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    float diff1 = max(dot(normal, uLight1Dir), 0.0);
    float diff2 = max(dot(normal, uLight2Dir), 0.0);
    vec3 lighting = uAmbientColor * uAmbientIntensity
      + uLight1Color * diff1 * uLight1Intensity
      + uLight2Color * diff2 * uLight2Intensity;

    float n = fbm(vWorldPosition * 1.5 + uTime * 0.15);
    vec3 noisyColor = mix(uBaseColor, uRimColor, n * uNoiseStrength);

    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.5);
    vec3 color = noisyColor * lighting + uRimColor * fresnel * 0.8;

    // Double-sided + no-depth-write means a closed box draws several overlapping
    // translucent layers (near face, far face(s), sometimes an open-corner interior
    // face) that alpha-blend on top of each other — a small per-layer opacity bump
    // here compounds fast into a near-opaque result. Keep the fresnel's alpha
    // contribution modest so the far side of the cube stays visible through the near
    // faces from any orbit angle, even though its brightness boost (above) can be bolder.
    gl_FragColor = vec4(color, clamp(uOpacity + fresnel * 0.1, 0.0, 1.0));
  }
`

// Plane stage (Task 7): a single faint light + weak noise tint, well short of full
// opacity, so the wireframe outline (rendered separately) stays the primary read and
// this fill is only "a first hint" — the deliberate midpoint between line's bare
// wireframe and the cube's full treatment.
const planeFragmentShader = /* glsl */ `
  ${noiseGLSL}

  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uBaseColor;
  uniform float uNoiseStrength;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform float uLightIntensity;
  uniform float uAmbientIntensity;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    float diff = max(dot(normal, uLightDir), 0.0);
    float lighting = uAmbientIntensity + diff * uLightIntensity;

    float n = fbm(vWorldPosition * 1.2 + uTime * 0.1);
    vec3 color = uBaseColor * (lighting + n * uNoiseStrength);

    gl_FragColor = vec4(color, uOpacity);
  }
`

export function useCubeMaterial() {
  return useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.32 },
        uBaseColor: { value: new Color('#5858a0') },
        uRimColor: { value: new Color('#b6a6ff') },
        uNoiseStrength: { value: 0.4 },
        uAmbientColor: { value: new Color(LIGHT_RIG.ambient.color) },
        uAmbientIntensity: { value: LIGHT_RIG.ambient.intensity },
        uLight1Dir: { value: lightDirection(LIGHT_RIG.key.position) },
        uLight1Color: { value: new Color(LIGHT_RIG.key.color) },
        uLight1Intensity: { value: LIGHT_RIG.key.intensity },
        uLight2Dir: { value: lightDirection(LIGHT_RIG.fill.position) },
        uLight2Color: { value: new Color(LIGHT_RIG.fill.color) },
        uLight2Intensity: { value: LIGHT_RIG.fill.intensity },
      },
      vertexShader: richnessVertexShader,
      fragmentShader: cubeFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })
    return withTimeUniform(material)
  }, [])
}

export function usePlaneFillMaterial() {
  return useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.24 },
        uBaseColor: { value: new Color('#7d7cc4') },
        uNoiseStrength: { value: 0.35 },
        uLightDir: { value: lightDirection(LIGHT_RIG.key.position) },
        uLightColor: { value: new Color(LIGHT_RIG.key.color) },
        uLightIntensity: { value: LIGHT_RIG.key.intensity },
        uAmbientIntensity: { value: LIGHT_RIG.ambient.intensity },
      },
      vertexShader: richnessVertexShader,
      fragmentShader: planeFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    })
    return withTimeUniform(material)
  }, [])
}

// Arrow (Task 9): the player's live-drawn arrow needs a hue distinct from the shape it's
// drawn against (warm gold vs. the shapes' cool indigo/violet), but the same "don't have
// one fixed look" rule from Task 7 still applies to it. `uRichness` fades the fresnel rim
// and noise tint in from 0 (line: flat, matching Stage 1's untouched minimalism) through
// a partial value (plane: a first hint, same idea as the plane fill) up to 1 (cube on:
// full treatment, matching the cube's own shader). Unlike the stage fills, the arrow
// stays fully opaque — it needs to read clearly as "your input," not blend into a
// translucent surface.
const arrowFragmentShader = /* glsl */ `
  ${noiseGLSL}

  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uRimColor;
  uniform float uRichness;
  uniform vec3 uAmbientColor;
  uniform float uAmbientIntensity;
  uniform vec3 uLight1Dir;
  uniform vec3 uLight1Color;
  uniform float uLight1Intensity;
  uniform vec3 uLight2Dir;
  uniform vec3 uLight2Color;
  uniform float uLight2Intensity;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    float diff1 = max(dot(normal, uLight1Dir), 0.0);
    float diff2 = max(dot(normal, uLight2Dir), 0.0);
    vec3 lighting = uAmbientColor * uAmbientIntensity
      + uLight1Color * diff1 * uLight1Intensity
      + uLight2Color * diff2 * uLight2Intensity;

    float n = fbm(vWorldPosition * 3.0 + uTime * 0.25);
    vec3 noisyColor = mix(uBaseColor, uRimColor, n * 0.3 * uRichness);

    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.5);
    vec3 color = noisyColor * lighting + uRimColor * fresnel * 0.6 * uRichness;

    gl_FragColor = vec4(color, 1.0);
  }
`

const ARROW_RICHNESS: Record<Stage, number> = {
  line: 0,
  plane: 0.5,
  cube: 1,
  reveal: 1,
  closing: 1,
}

// The fill light only exists in the real scene from the cube stage on (see
// `Experience.tsx`'s `SceneLights`) — mirror that here so the arrow's hand-rolled
// lighting never implies a light that isn't actually in the scene.
function arrowFillIntensity(stage: Stage): number {
  return stage === 'line' || stage === 'plane' ? 0 : LIGHT_RIG.fill.intensity
}

// Rebuilt whenever `stage` changes, rather than mutated in place, because
// eslint-plugin-react-hooks' compiler-based immutability check treats a value returned
// from `useMemo` as frozen everywhere outside its own factory — including inside a
// `useEffect` — the same rule `withTimeUniform`'s doc comment above works around for
// `uTime`. A fresh, cheap ShaderMaterial per stage change is the straightforward way to
// stay inside that rule.
export function useArrowMaterial(stage: Stage) {
  return useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new Color('#ffb454') },
        uRimColor: { value: new Color('#fff3d6') },
        uRichness: { value: ARROW_RICHNESS[stage] },
        uAmbientColor: { value: new Color(LIGHT_RIG.ambient.color) },
        uAmbientIntensity: { value: LIGHT_RIG.ambient.intensity },
        uLight1Dir: { value: lightDirection(LIGHT_RIG.key.position) },
        uLight1Color: { value: new Color(LIGHT_RIG.key.color) },
        uLight1Intensity: { value: LIGHT_RIG.key.intensity },
        uLight2Dir: { value: lightDirection(LIGHT_RIG.fill.position) },
        uLight2Color: { value: new Color(LIGHT_RIG.fill.color) },
        uLight2Intensity: { value: arrowFillIntensity(stage) },
      },
      vertexShader: richnessVertexShader,
      fragmentShader: arrowFragmentShader,
    })
    return withTimeUniform(material)
  }, [stage])
}
