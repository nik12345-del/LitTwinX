import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import posterImg from '../assets/litwinx_poster.png';

const GlowLiver = () => {
  // Advanced 3D interaction for the whole poster to give depth
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        perspective: '1500px',
        cursor: 'pointer'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '600px',
          maxHeight: '900px',
          position: 'relative',
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Cinematic Shine Overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.05) 0%, transparent 60%)',
          zIndex: 2,
          pointerEvents: 'none'
        }} />

        <motion.img
          src={posterImg}
          alt="LiTwinX Digital Liver Analytics"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 20px 50px rgba(0,0,0,1))',
            transform: 'translateZ(50px)'
          }}
        />

        {/* Floating Particles Effect (Animated) */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              width: Math.random() * 3 + 'px',
              height: Math.random() * 3 + 'px',
              background: Math.random() > 0.5 ? '#ff3b30' : '#4dabf7',
              borderRadius: '50%',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              zIndex: 1,
              transform: `translateZ(${Math.random() * 100 + 50}px)`
            }}
            animate={{
              opacity: [0, 0.8, 0],
              y: [0, -50, 0],
              x: [0, (Math.random() - 0.5) * 50, 0]
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 5
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
};

export default GlowLiver;
