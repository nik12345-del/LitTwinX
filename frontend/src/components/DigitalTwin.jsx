import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, MeshDistortMaterial, Environment, Sphere } from '@react-three/drei';

const LiverModel = ({ active, tumorSeverity, currentMonth = 0, growthRate = 0.1 }) => {
  const meshRef = useRef();
  
  // Calculate specific growth scale based on month and rate
  const growthScale = 1 + (growthRate * currentMonth);
  
  useFrame((state) => {
    meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.2;
    meshRef.current.position.y = Math.sin(state.clock.getElapsedTime()) * 0.1;
  });

  return (
    <group>
      {/* Main Liver Body */}
      <mesh ref={meshRef} scale={[1.5, 0.8, 1]} position={[0, 0, 0]}>
        <sphereGeometry args={[1.5, 64, 64]} />
        <MeshDistortMaterial
          color={active ? "#8b2a2a" : "#4a1c1c"}
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0.2}
          roughness={0.5}
          distort={0.4}
          speed={1.5}
        />
        
        {/* Growth Simulation */}
        {active && (
          <group>
            {/* Primary Tumor */}
            <mesh position={[0.5, 0.2, 0.8]} scale={(1 + tumorSeverity * 0.5) * growthScale}>
              <sphereGeometry args={[0.3, 32, 32]} />
              <MeshDistortMaterial
                color="#ef4444"
                emissive="#ff0000"
                emissiveIntensity={1.5 + (Math.sin(Date.now() / 500) * 0.5)}
                distort={0.6}
                speed={4}
              />
            </mesh>
            {/* Secondary Satellite (if severe enough) */}
            {(tumorSeverity > 0.4) && (
              <mesh position={[-0.8, -0.3, 0.5]} scale={(0.8 + tumorSeverity * 0.3) * growthScale}>
                <sphereGeometry args={[0.2, 32, 32]} />
                <MeshDistortMaterial
                  color="#f59e0b"
                  emissive="#f59e0b"
                  emissiveIntensity={1}
                  distort={0.5}
                  speed={3}
                />
              </mesh>
            )}
          </group>
        )}
      </mesh>
    </group>
  );
};

const DigitalTwin = ({ analysisActive, riskFactor, currentMonth, tumorType }) => {
  // Mapping growth rate same as backend for visual consistency
  const growthRate = useMemo(() => {
    if (tumorType === "Benign") return 0.05;
    if (tumorType?.includes("Hepatocellular")) return 0.15;
    if (tumorType?.includes("Cholangiocarcinoma")) return 0.10;
    return 0.10;
  }, [tumorType]);

  return (
    <div className="w-full h-full min-h-[350px] bg-black/40 rounded-2xl border border-white/5 relative overflow-hidden">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h3 className="text-white font-bold tracking-tight">Digital Twin LTX-3D</h3>
        <p className="text-primary text-[10px] font-mono tracking-widest uppercase">
          {currentMonth === 0 ? "LIVE SCAN DATA" : `SIMULATION: T+${currentMonth} MO`}
        </p>
      </div>

      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <spotLight position={[-10, -10, -10]} intensity={0.5} color="#ef4444" />
        <LiverModel 
           active={analysisActive} 
           tumorSeverity={riskFactor} 
           currentMonth={currentMonth} 
           growthRate={growthRate} 
        />
        <OrbitControls enableZoom={true} enablePan={false} autoRotate={!analysisActive} />
        <Environment preset="night" />
      </Canvas>

      <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs font-mono text-white/50 pointer-events-none">
        <span>MODEL ID: LTX-V1</span>
        <span className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${analysisActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            {analysisActive ? 'STABLE' : 'IDLE'}
        </span>
      </div>
    </div>
  );
};

export default DigitalTwin;
