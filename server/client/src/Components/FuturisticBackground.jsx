import React from 'react';

const FuturisticBackground = ({ 
  children, 
  variant = 'default',
  particleCount = 30,
  showGrid = true,
  className = ''
}) => {
  const getBackgroundStyle = () => {
    switch (variant) {
      case 'auth':
        return 'bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900';
      case 'main':
        return 'bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900';
      case 'explore':
        return 'bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900';
      default:
        return 'bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900';
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden ${getBackgroundStyle()} ${className}`}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20"></div>
        
        {/* Animated Particles */}
        <div className="absolute top-0 left-0 w-full h-full">
          {[...Array(particleCount)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            />
          ))}
        </div>
        
        {/* Futuristic Grid Pattern */}
        {showGrid && (
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `
                linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px'
            }}></div>
          </div>
        )}
        
        {/* Additional Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default FuturisticBackground; 