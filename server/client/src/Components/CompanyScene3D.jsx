import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, Environment } from '@react-three/drei';

function FloatingText({ position, text, color }) {
  const meshRef = useRef();
  
  useFrame((state) => {
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <Text
        ref={meshRef}
        position={position}
        fontSize={0.5}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {text}
      </Text>
    </Float>
  );
}

function FloatingCube() {
  const meshRef = useRef();
  
  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta * 0.5;
    meshRef.current.rotation.y += delta * 0.2;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.2;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#4f46e5"
        metalness={0.5}
        roughness={0.2}
        envMapIntensity={1}
      />
    </mesh>
  );
}

export default function CompanyScene3D() {
  return (
    <div className="w-full h-[400px]">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <FloatingCube />
        <FloatingText position={[-2, 1, 0]} text="AI" color="#4f46e5" />
        <FloatingText position={[2, 1, 0]} text="XR" color="#8b5cf6" />
        <FloatingText position={[0, -1, 0]} text="3D" color="#ec4899" />
        <OrbitControls enableZoom={false} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
} 