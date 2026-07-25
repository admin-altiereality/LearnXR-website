import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface LandingHeroSceneProps {
  active?: boolean;
}

function KnowledgeOrb({
  position,
  color,
  scale = 1,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
}) {
  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.8}>
      <mesh position={position} scale={scale}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} />
      </mesh>
    </Float>
  );
}

function SceneContents({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    const count = 80;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (!active || !group.current) return;
    const t = state.clock.elapsedTime;
    const { x, y } = state.pointer;
    group.current.rotation.y = t * 0.08 + x * 0.15;
    group.current.rotation.x = Math.sin(t * 0.2) * 0.05 + y * 0.08;
  });

  return (
    <group ref={group}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 2]} intensity={1.1} color="#c4b5fd" />
      <pointLight position={[-3, -2, 2]} intensity={0.6} color="#22d3ee" />

      <Float speed={0.8} rotationIntensity={0.25} floatIntensity={0.35}>
        <mesh position={[0, 0.2, 0]}>
          <torusGeometry args={[1.35, 0.08, 12, 48]} />
          <meshStandardMaterial color="#7c3aed" emissive="#4c1d95" emissiveIntensity={0.35} metalness={0.4} roughness={0.3} />
        </mesh>
      </Float>

      <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.55, 24, 24]} />
          <meshStandardMaterial color="#1e1b4b" emissive="#312e81" emissiveIntensity={0.4} roughness={0.45} />
        </mesh>
      </Float>

      <KnowledgeOrb position={[-2.4, 1.1, -0.4]} color="#38bdf8" scale={0.7} />
      <KnowledgeOrb position={[2.6, 0.6, 0.2]} color="#a78bfa" scale={0.85} />
      <KnowledgeOrb position={[-1.8, -1.2, 0.5]} color="#67e8f9" scale={0.55} />
      <KnowledgeOrb position={[1.9, -0.9, -0.6]} color="#818cf8" scale={0.6} />

      <Float speed={0.9} rotationIntensity={0.5} floatIntensity={0.6}>
        <mesh position={[0.2, 1.8, -0.8]} rotation={[0.4, 0.2, 0.1]}>
          <boxGeometry args={[0.7, 0.1, 0.95]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>
      </Float>

      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particles.length / 3}
            array={particles}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial size={0.035} color="#c4b5fd" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}

export default function LandingHeroScene({ active = true }: LandingHeroSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.3, 6.2], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContents active={active} />
    </Canvas>
  );
}
