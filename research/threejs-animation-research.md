# Three.js Animation Research - Ika Tensei NFT Reincarnation Protocol

Research findings for implementing cutting-edge Three.js animations for an NFT reincarnation frontend with "death and rebirth" theme.

---

## 1. Portal/Wormhole Effect

### Overview
The portal effect is central to the "seal" process where NFTs transition from death chain (ETH/SUI) to rebirth chain (Solana). Key elements:
- **Death side**: Dark purple/blue color scheme with ethereal mist
- **Rebirth side**: Golden/bright warm colors with light rays
- **Transition**: Particle vortex pulling NFT through

### Shader-Based Portal Effects

**Reference**: Codrops Dissolve Effect Tutorial
- URL: https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/

**Core Concepts**:
- Use Perlin noise for organic edge patterns
- Discard fragments based on noise threshold (`uProgress` uniform)
- Edge glow using `uEdge` uniform to color boundary pixels

```glsl
// Fragment shader for portal edge
shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
  float noise = cnoise(vPos * uFreq) * uAmp;
  if(noise < uProgress) discard;
  
  float edgeWidth = uProgress + uEdge;
  if(noise > uProgress && noise < edgeWidth) {
    gl_FragColor = vec4(vec3(uEdgeColor), noise);
  }
`);
```

### Particle Vortex Animation

**Reference**: GPGPU Dreamy Particles
- URL: https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/

Use GPUComputationRenderer for thousands of particles with mouse interaction:

```javascript
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

// Velocity shader - particles spiral toward center
simFragmentVelocity.glsl:
uniform vec3 uMouse;
uniform float uMouseSpeed;

void main() {
  vec3 position = texture2D(uCurrentPosition, vUv).xyz;
  vec3 velocity = texture2D(uCurrentVelocity, vUv).xyz;
  
  // Spiral force
  vec3 toCenter = -normalize(position);
  vec3 tangent = cross(toCenter, vec3(0.0, 1.0, 0.0));
  velocity += tangent * 0.001;
  velocity += toCenter * 0.0005;
  
  gl_FragColor = vec4(velocity, 1.0);
}
```

### Implementation with @react-three/fiber

```jsx
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial } from '@react-three/drei';

function Portal({ progress, colorA, colorB }) {
  const materialRef = useRef();
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.distort = 0.3 + Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });
  
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[2, 0.8, 32, 100]} />
      <MeshDistortMaterial
        ref={materialRef}
        color={progress > 0.5 ? colorB : colorA}
        emissive={progress > 0.5 ? '#ffd700' : '#4a0080'}
        emissiveIntensity={2}
        speed={2}
        distort={0.3}
      />
    </mesh>
  );
}
```

---

## 2. NFT Card Animations

### Holographic/Iridescent Shader

Create a custom shader that shifts colors based on view angle (Fresnel effect):

```glsl
// Iridescent fragment shader
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;

void main() {
  vec3 viewDir = normalize(vViewPosition);
  vec3 normal = normalize(vNormal);
  
  float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 3.0);
  
  // Rainbow shift based on fresnel and time
  vec3 color = mix(uColorA, uColorB, fresnel);
  color += 0.5 * sin(uTime + fresnel * 6.28) * vec3(1.0, 0.5, 0.8);
  
  gl_FragColor = vec4(color, 1.0);
}
```

### Card Flip Animation

Using @react-three/drei's `Float` and React state for flip:

```jsx
import { useState } from 'react';
import { Float, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function NFTCard({ frontImage, backImage, isFlipped }) {
  const [flipProgress, setFlipProgress] = useState(0);
  
  useFrame((state, delta) => {
    const target = isFlipped ? 1 : 0;
    setFlipProgress(prev => THREE.MathUtils.lerp(prev, target, delta * 3));
  });
  
  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <group rotation={[0, flipProgress * Math.PI, 0]}>
        {/* Front face */}
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[2, 3]} />
          <meshStandardMaterial map={frontImage} />
        </mesh>
        
        {/* Back face (reborn version) */}
        <mesh position={[0, 0, -0.01]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[2, 3]} />
          <meshStandardMaterial map={backImage} emissive="#ffd700" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </Float>
  );
}
```

### Card Dissolve/Materialize Effect

**Reference**: Wawa Sensei R3F Dissolve Tutorial
- URL: https://wawasensei.dev/tuto/react-three-fiber-tutorial-dissolve-effect
- Live Demo: https://r3f-objects-dissolve.vercel.app/

Use custom shader material with noise-based discard:

```jsx
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';

const DissolveMaterial = shaderMaterial(
  {
    uProgress: 0,
    uTime: 0,
    uColor: new THREE.Color('#ff6b6b'),
    uEdgeColor: new THREE.Color('#ffd700'),
    uNoiseScale: 3.0,
  },
  // Vertex shader
  `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform float uProgress;
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uEdgeColor;
    uniform float uNoiseScale;
    varying vec2 vUv;
    varying vec3 vPosition;
    
    // Simplex noise function
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    
    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    
    void main() {
      float n = noise(vPosition.xy * uNoiseScale + uTime * 0.1);
      float threshold = uProgress;
      
      if (n < threshold) discard;
      
      // Edge glow
      float edge = smoothstep(threshold, threshold + 0.1, n);
      vec3 color = mix(uEdgeColor, uColor, edge);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
);

extend({ DissolveMaterial });

function DissolvingCard({ progress }) {
  const materialRef = useRef();
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uProgress = progress;
      materialRef.current.uTime = state.clock.elapsedTime;
    }
  });
  
  return (
    <mesh>
      <boxGeometry args={[2, 3, 0.1]} />
      <dissolveMaterial ref={materialRef} />
    </mesh>
  );
}
```

### Floating Cards in 3D Space

```jsx
import { Float, Sparkles } from '@react-three/drei';

function FloatingCards({ cards }) {
  return (
    <group>
      {cards.map((card, i) => (
        <Float
          key={card.id}
          speed={2 + i * 0.5}
          rotationIntensity={0.3}
          floatIntensity={0.5 + i * 0.2}
          position={[
            Math.sin(i * 0.8) * 3,
            Math.cos(i * 0.6) * 2,
            i * -2
          ]}
        >
          <NFTCard {...card} />
        </Float>
      ))}
      <Sparkles count={200} scale={10} size={2} speed={0.4} />
    </group>
  );
}
```

---

## 3. Chain Visualization

### Orbiting Chain Logos

```jsx
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

function ChainOrbit({ chains, activeChain }) {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });
  
  return (
    <group ref={groupRef}>
      {chains.map((chain, i) => {
        const angle = (i / chains.length) * Math.PI * 2;
        const radius = 4;
        
        return (
          <group
            key={chain.name}
            position={[
              Math.cos(angle) * radius,
              Math.sin(i * 0.5) * 0.5,
              Math.sin(angle) * radius
            ]}
          >
            {/* Chain logo sphere */}
            <mesh>
              <sphereGeometry args={[0.5, 32, 32]} />
              <meshStandardMaterial
                color={chain.color}
                emissive={chain.name === activeChain ? chain.color : '#000'}
                emissiveIntensity={chain.name === activeChain ? 1 : 0}
              />
            </mesh>
            <Text
              position={[0, 0.8, 0]}
              fontSize={0.3}
              color={chain.name === activeChain ? '#fff' : '#888'}
            >
              {chain.name}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
```

### Connection Lines/Beams

```jsx
function ChainConnections({ chains }) {
  const points = chains.map(c => c.position);
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  
  return (
    <line geometry={lineGeometry}>
      <lineDashedMaterial
        color="#4a0080"
        dashSize={0.2}
        gapSize={0.1}
        linewidth={2}
      />
    </line>
  );
}
```

### Data Flow Particles

```jsx
function DataFlowParticles({ from, to }) {
  const particlesRef = useRef();
  const count = 20;
  
  useFrame((state) => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < count; i++) {
        const t = ((state.clock.elapsedTime * 0.5 + i / count) % 1);
        positions[i * 3] = THREE.MathUtils.lerp(from[0], to[0], t);
        positions[i * 3 + 1] = THREE.MathUtils.lerp(from[1], to[1], t);
        positions[i * 3 + 2] = THREE.MathUtils.lerp(from[2], to[2], t);
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={new Float32Array(count * 3)}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#ffd700" transparent opacity={0.8} />
    </points>
  );
}
```

---

## 4. Background Effects

### Starfield/Nebula Shader

**Using @react-three/drei**:

```jsx
import { Stars, Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

function StarfieldBackground() {
  return (
    <group>
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      <Sparkles
        count={200}
        scale={12}
        size={4}
        speed={0.4}
        opacity={0.5}
        color="#8b5cf6"
      />
    </group>
  );
}
```

### Nebula Shader Background

```glsl
// Custom nebula shader
varying vec2 vUv;
uniform float uTime;

float noise(vec2 p) {
  // Simplex noise implementation
}

void main() {
  vec2 uv = vUv;
  
  // Layer multiple noise fields
  float n = noise(uv * 3.0 + uTime * 0.05);
  n += noise(uv * 6.0 - uTime * 0.03) * 0.5;
  n += noise(uv * 12.0 + uTime * 0.01) * 0.25;
  
  // Color gradient - deep purple to blue
  vec3 colorA = vec3(0.1, 0.0, 0.3); // Deep purple
  vec3 colorB = vec3(0.0, 0.1, 0.4); // Dark blue
  vec3 color = mix(colorA, colorB, n);
  
  gl_FragColor = vec4(color, 1.0);
}
```

### Mouse Parallax

```jsx
function ParallaxBackground() {
  const groupRef = useRef();
  const { mouse } = useThree();
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = mouse.y * 0.05;
      groupRef.current.rotation.y = mouse.x * 0.05;
    }
  });
  
  return (
    <group ref={groupRef}>
      <StarfieldBackground />
    </group>
  );
}
```

### Dark Mode with Neon Accents

```jsx
function NeonAccents() {
  return (
    <group>
      {/* Ambient dark lighting */}
      <ambientLight intensity={0.1} />
      
      {/* Neon point lights */}
      <pointLight position={[-5, 5, 5]} color="#8b5cf6" intensity={2} />
      <pointLight position={[5, -5, 5]} color="#06b6d4" intensity={2} />
      <pointLight position={[0, 5, -5]} color="#fbbf24" intensity={1} />
      
      {/* Rim lighting for NFTs */}
      <spotLight
        position={[0, 10, 0]}
        angle={0.3}
        penumbra={1}
        intensity={1}
        color="#ffffff"
      />
    </group>
  );
}
```

---

## 5. Progress/Status Animations

### Circular Progress with 3D Depth

```jsx
import { useFrame } from '@react-three/fiber';
import { Ring, Text } from '@react-three/drei';

function CircularProgress({ progress, label }) {
  const ringRef = useRef();
  
  useFrame(() => {
    if (ringRef.current) {
      // Animate the arc based on progress
      ringRef.current.rotation.z = -progress * Math.PI * 2;
    }
  });
  
  return (
    <group>
      {/* Background ring */}
      <Ring args={[1, 1.2, 64]}>
        <meshBasicMaterial color="#1a1a2e" />
      </Ring>
      
      {/* Progress ring */}
      <mesh ref={ringRef} rotation={[0, 0, 0]}>
        <ringGeometry args={[1, 1.2, 64, 1, 0, Math.PI * 2 * progress]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>
      
      {/* Glow effect */}
      <Ring args={[0.9, 1.3, 64]}>
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      <Text
        position={[0, 0, 0.1]}
        fontSize={0.4}
        color="#fff"
        anchorX="center"
        anchorY="middle"
      >
        {`${Math.round(progress * 100)}%`}
      </Text>
    </group>
  );
}
```

### Step-by-Step Progress (Seal → Sign → Verify → Mint)

```jsx
function ProgressSteps({ currentStep, steps }) {
  return (
    <group>
      {steps.map((step, i) => (
        <group key={step.name} position={[i * 2 - (steps.length - 1), 0, 0]}>
          {/* Step circle */}
          <mesh>
            <circleGeometry args={[0.4, 32]} />
            <meshStandardMaterial
              color={i < currentStep ? '#10b981' : i === currentStep ? '#ffd700' : '#374151'}
              emissive={i === currentStep ? '#ffd700' : '#000'}
              emissiveIntensity={i === currentStep ? 0.5 : 0}
            />
          </mesh>
          
          {/* Step label */}
          <Text position={[0, -0.7, 0]} fontSize={0.2} color="#fff">
            {step.label}
          </Text>
          
          {/* Connector line */}
          {i < steps.length - 1 && (
            <mesh position={[0.7, 0, 0]}>
              <planeGeometry args={[1.4, 0.05]} />
              <meshBasicMaterial color={i < currentStep ? '#10b981' : '#374151'} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
```

### Sacred Seal Rune Animation

```jsx
import { MeshDistortMaterial } from '@react-three/drei';

function SacredSeal() {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.elapsedTime * 0.2;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Outer ring */}
      <mesh>
        <torusGeometry args={[1.5, 0.1, 16, 100]} />
        <MeshDistortMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={2}
          speed={2}
          distort={0.2}
        />
      </mesh>
      
      {/* Inner geometric pattern */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.2, 6]} />
        <meshBasicMaterial color="#ffd700" wireframe />
      </mesh>
      
      {/* Center rune */}
      <Text
        position={[0, 0, 0.1]}
        fontSize={1}
        color="#ffd700"
        anchorX="center"
        anchorY="middle"
      >
        ⛧
      </Text>
    </group>
  );
}
```

### Completion Celebration (Particle Explosion)

```jsx
import { Explosions } from '@react-three/drei';

function CelebrationEffect({ trigger }) {
  if (!trigger) return null;
  
  return (
    <Explosions
      count={3}
      scale={5}
      size={10}
      speed={0.4}
      opacity={1}
      color={['#ffd700', '#ff6b6b', '#8b5cf6']}
    />
  );
}
```

Or create custom confetti:

```jsx
function Confetti({ count = 100 }) {
  const ref = useRef();
  
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.5;
      const positions = ref.current.geometry.attributes.position.array;
      
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 1] -= 0.02; // Fall down
        if (positions[i * 3 + 1] < -5) {
          positions[i * 3 + 1] = 5; // Reset to top
        }
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  // Generate random confetti positions and colors
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = Math.random() * 10 - 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
    
    const color = new THREE.Color().setHSL(Math.random(), 1, 0.5);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} vertexColors transparent opacity={0.8} />
    </points>
  );
}
```

---

## 6. Performance Considerations

### React Three Fiber Setup

```jsx
import { Canvas } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import { Preload } from '@react-three/drei';

function Scene() {
  return (
    <Canvas
      dpr={[1, 2]} // Handle high-DPI screens
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      camera={{ position: [0, 0, 5], fov: 50 }}
    >
      <Suspense fallback={null}>
        <AppContent />
      </Suspense>
      <Preload all />
    </Canvas>
  );
}
```

### Suspense Loading Patterns

```jsx
import { useProgress, Html } from '@react-three/drei';

function Loader() {
  const { progress } = useProgress();
  
  return (
    <Html center>
      <div style={{ color: '#fff', fontSize: '1.5rem' }}>
        {progress.toFixed(0)}% loaded
      </div>
      <div style={{ width: '200px', height: '4px', background: '#333', marginTop: '10px' }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: '#ffd700',
          }}
        />
      </div>
    </Html>
  );
}

function App() {
  return (
    <Canvas>
      <Suspense fallback={<Loader />}>
        <MainContent />
      </Suspense>
    </Canvas>
  );
}
```

### Mobile Performance

```jsx
function AdaptiveScene() {
  const isMobile = useMemo(() => {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);
  
  return (
    <Canvas
      dpr={isMobile ? 1 : [1, 2]}
      performance={{ min: 0.5 }}
    >
      {/* Reduce particles on mobile */}
      {isMobile ? (
        <Stars count={1000} />
      ) : (
        <Stars count={5000} />
      )}
      
      {/* Simpler shaders on mobile */}
      {isMobile ? (
        <SimplePortal />
      ) : (
        <ComplexPortalWithBloom />
      )}
    </Canvas>
  );
}
```

### GPU Detection & Quality Scaling

```jsx
import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';

function useGPUTier() {
  const [tier, setTier] = useState(1);
  const gl = useThree((s) => s.gl);
  
  useEffect(() => {
    const debugInfo = gl.getContext().getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getContext().getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      
      // High-end GPUs
      if (/RTX|Radeon RX [567]/i.test(renderer)) {
        setTier(3);
      } 
      // Mid-range
      else if (/GTX|Radeon RX [34]/i.test(renderer)) {
        setTier(2);
      }
      // Low-end / integrated
      else {
        setTier(1);
      }
    }
  }, [gl]);
  
  return tier;
}

function QualityAdapter() {
  const tier = useGPUTier();
  
  const settings = {
    1: { particles: 500, bloom: false, shadows: false },
    2: { particles: 2000, bloom: true, shadows: false },
    3: { particles: 5000, bloom: true, shadows: true },
  };
  
  return settings[tier];
}
```

---

## 7. Specific Libraries/Tools

### @react-three/fiber + @react-three/drei

**Installation**:
```bash
npm install three @react-three/fiber @react-three/drei
```

**Key Components**:
- `Float` - Floating animation for cards
- `MeshDistortMaterial` - Warped/distorted materials for portals
- `Sparkles` - Particle sparkles
- `Stars` - Starfield background
- `Text` - 3D text
- `useFrame` - Per-frame animation
- `shaderMaterial` - Custom shader creation

### @react-three/postprocessing

**Installation**:
```bash
npm install @react-three/postprocessing postprocessing
```

**Effects**:

```jsx
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

function Effects() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.5}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[0.002, 0.002]}
      />
      <Vignette
        offset={0.3}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
```

### GSAP for Timeline Animations

**Installation**:
```bash
npm install gsap
```

**Usage with R3F**:

```jsx
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';

function AnimatePortalTransition({ progress }) {
  const portalRef = useRef();
  const { camera } = useThree();
  
  useEffect(() => {
    // Animate camera position
    gsap.to(camera.position, {
      z: 3,
      duration: 2,
      ease: 'power2.inOut',
    });
    
    // Animate portal scale
    gsap.to(portalRef.current.scale, {
      x: 1.5,
      y: 1.5,
      duration: 1.5,
      ease: 'elastic.out(1, 0.5)',
    });
    
    // Animate color transition
    gsap.to(portalRef.current.material.color, {
      r: 1,
      g: 0.84,
      b: 0,
      duration: 1,
      delay: 0.5,
    });
  }, [progress]);
  
  return (
    <mesh ref={portalRef}>
      <torusGeometry args={[2, 0.5, 32, 100]} />
      <meshStandardMaterial color="#4a0080" />
    </mesh>
  );
}
```

### Framer Motion for UI Transitions

**Installation**:
```bash
npm install framer-motion
```

**Integration with HTML overlays**:

```jsx
import { motion, AnimatePresence } from 'framer-motion';

function UIOverlay({ step }) {
  return (
    <AnimatePresence>
      {step === 'seal' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
        >
          <h1>Sealing your NFT...</h1>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### Leva for Dev Controls

**Installation**:
```bash
npm install leva
```

**Usage**:

```jsx
import { useControls } from 'leva';

function DebugPanel() {
  const { color, intensity, particles } = useControls('Portal', {
    color: '#4a0080',
    intensity: { value: 1, min: 0, max: 3 },
    particles: { value: 1000, min: 100, max: 5000, step: 100 },
  });
  
  return (
    <mesh>
      <sphereGeometry />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} />
    </mesh>
  );
}
```

---

## 8. Project Structure Recommendation

```
src/
├── components/
│   ├── Scene.jsx           # Main Canvas setup
│   ├── Portal.jsx          # Wormhole/portal effect
│   ├── NFTCard.jsx         # 3D NFT card with flip/dissolve
│   ├── ChainOrbit.jsx      # Orbiting chain logos
│   ├── Background.jsx      # Starfield/nebula
│   ├── ProgressSteps.jsx  # Step-by-step progress
│   ├── Effects.jsx         # Post-processing
│   └── UI/                 # HTML overlays
│       └── Overlay.jsx
├── shaders/
│   ├── dissolve.glsl
│   ├── portal.glsl
│   └── nebula.glsl
├── hooks/
│   └── useGPUTier.js
├── App.jsx
└── main.jsx
```

---

## 9. Key Resources & References

### Tutorials
1. **Codrops Dissolve Effect**: https://tympanus.net/codrops/2025/02/17/implementing-a-dissolve-effect-with-shaders-and-particles-in-three-js/
2. **Wawa Sensei R3F Dissolve**: https://wawasensei.dev/tuto/react-three-fiber-tutorial-dissolve-effect
3. **GPGPU Dreamy Particles**: https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/

### Documentation
- **React Three Fiber**: https://docs.pmnd.rs/react-three-fiber/
- **@react-three/drei**: https://github.com/pmndrs/drei
- **Three.js Shaders**: https://thebookofshaders.com/
- **Postprocessing**: https://github.com/pmndrs/postprocessing

### Example Projects
- **R3F Dissolve Demo**: https://r3f-objects-dissolve.vercel.app/
- **Codrops Particles**: https://tympanus.net/Tutorials/DreamyParticles

---

## 10. Implementation Priority

For the "death and rebirth" NFT reincarnation theme:

1. **Phase 1 - Core** (Essential):
   - Portal with MeshDistortMaterial
   - Basic card flip animation
   - Starfield background
   - Progress steps UI

2. **Phase 2 - Visual Polish**:
   - Dissolve effect on NFT cards
   - Chain orbit visualization
   - Post-processing (Bloom, Vignette)

3. **Phase 3 - Advanced**:
   - GPGPU particle vortex
   - Data flow particles between chains
   - Sacred seal animation
   - Celebration confetti

4. **Phase 4 - Optimization**:
   - GPU tier detection
   - Mobile quality scaling
   - Performance monitoring
