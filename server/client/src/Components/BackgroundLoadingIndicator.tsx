/**
 * BackgroundLoadingIndicator - Eye-pleasing loading indicator for generation processes
 * 
 * Features:
 * - Glassmorphism design matching the website aesthetic
 * - Animated gradient particles and waves
 * - Progress display with smooth animations
 * - Multiple generation type support (Skybox, 3D Assets, etc.)
 */

import React, { useEffect, useState } from 'react';

interface BackgroundLoadingIndicatorProps {
  isVisible: boolean;
  type?: 'skybox' | '3d-asset' | 'unified' | 'general';
  progress?: number;
  message?: string;
  stage?: string;
  onClose?: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
}

const BackgroundLoadingIndicator: React.FC<BackgroundLoadingIndicatorProps> = ({
  isVisible,
  type = 'general',
  progress = 0,
  message,
  stage,
  onClose
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [waveOffset, setWaveOffset] = useState(0);

  // Generate particles
  useEffect(() => {
    if (!isVisible) return;

    const generateParticles = (): Particle[] => {
      const colors = [
        'rgba(14, 165, 233, 0.4)', // sky-500
        'rgba(139, 92, 246, 0.4)', // violet-500
        'rgba(16, 185, 129, 0.4)', // emerald-500
        'rgba(236, 72, 153, 0.4)', // pink-500
      ];

      return Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        speed: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
    };

    setParticles(generateParticles());

    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        y: (p.y + p.speed) % 100,
        x: p.x + Math.sin(p.y * 0.1) * 0.1
      })));
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Animate wave
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setWaveOffset(prev => (prev + 0.5) % 100);
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'skybox':
        return {
          gradient: 'from-sky-500 via-indigo-500 to-emerald-400',
          glowColor: 'rgba(14, 165, 233, 0.3)',
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          title: 'Generating Skybox'
        };
      case '3d-asset':
        return {
          gradient: 'from-purple-500 via-pink-500 to-rose-400',
          glowColor: 'rgba(139, 92, 246, 0.3)',
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          title: 'Generating 3D Asset'
        };
      case 'unified':
        return {
          gradient: 'from-violet-500 via-purple-500 to-sky-500',
          glowColor: 'rgba(139, 92, 246, 0.3)',
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
          title: 'Generating Assets'
        };
      default:
        return {
          gradient: 'from-sky-500 via-purple-500 to-emerald-400',
          glowColor: 'rgba(14, 165, 233, 0.3)',
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          title: 'Processing'
        };
    }
  };

  const config = getTypeConfig();

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Animated Background Overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#141414] to-[#1a1a1a] transition-opacity duration-500"
        style={{ opacity: isVisible ? 0.85 : 0 }}
      />

      {/* Animated Wave Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(
            90deg,
            transparent ${waveOffset}%,
            ${config.glowColor} ${waveOffset + 10}%,
            transparent ${waveOffset + 20}%
          )`,
          backgroundSize: '200% 100%',
          animation: 'wave 3s ease-in-out infinite'
        }}
      />

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full blur-sm"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              transition: 'all 0.1s linear'
            }}
          />
        ))}
      </div>

      {/* Main Loading Card */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-auto">
        <div 
          className="
            relative
            backdrop-blur-2xl
            bg-[#141414]/95
            border border-[#262626]
            rounded-3xl
            shadow-[0_8px_32px_rgba(0,0,0,0.6)]
            p-8 md:p-12
            max-w-md w-full
            transform transition-all duration-500
          "
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
            boxShadow: `0 0 60px ${config.glowColor}, 0 8px 32px rgba(0,0,0,0.6)`
          }}
        >
          {/* Gradient Border Glow */}
          <div 
            className="absolute -inset-0.5 rounded-3xl opacity-50 blur-xl"
            style={{
              background: `linear-gradient(135deg, ${config.glowColor}, transparent)`
            }}
          />

          {/* Content */}
          <div className="relative z-10">
            {/* Icon with Rotation */}
            <div className="flex justify-center mb-6">
              <div 
                className={`
                  relative
                  p-4
                  rounded-2xl
                  bg-gradient-to-br ${config.gradient}
                  shadow-lg
                  animate-pulse
                `}
                style={{
                  animation: 'spin 3s linear infinite'
                }}
              >
                <div className="text-white">
                  {config.icon}
                </div>
                {/* Rotating Ring */}
                <div 
                  className="absolute -inset-1 rounded-2xl border-2 border-transparent"
                  style={{
                    borderTopColor: 'rgba(255, 255, 255, 0.3)',
                    borderRightColor: 'rgba(255, 255, 255, 0.1)',
                    animation: 'spin 2s linear infinite'
                  }}
                />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-white text-center mb-2">
              {config.title}
            </h3>

            {/* Message */}
            {message && (
              <p className="text-sm text-gray-400 text-center mb-6 min-h-[20px]">
                {message}
              </p>
            )}

            {/* Stage */}
            {stage && (
              <p className="text-xs text-gray-500 text-center mb-4 uppercase tracking-wider">
                {stage}
              </p>
            )}

            {/* Progress Bar */}
            {progress !== undefined && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Progress</span>
                  <span className={`font-semibold bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#1f1f1f] overflow-hidden border border-[#2a2a2a]">
                  <div
                    className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-500 ease-out rounded-full relative overflow-hidden`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  >
                    {/* Shimmer Effect */}
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      style={{
                        animation: 'shimmer 2s infinite',
                        transform: 'translateX(-100%)'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Animated Dots */}
            {!progress && (
              <div className="flex justify-center gap-2 mt-6">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full bg-gradient-to-r ${config.gradient}`}
                    style={{
                      animation: `pulse 1.5s ease-in-out infinite`,
                      animationDelay: `${i * 0.2}s`
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Close Button (optional) */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes wave {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
};

export default BackgroundLoadingIndicator;

