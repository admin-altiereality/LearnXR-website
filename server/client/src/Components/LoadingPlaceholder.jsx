import React from 'react';

const LoadingPlaceholder = ({ progress, currentSkyboxIndex, numVariations }) => {
  return (
    <div className="relative w-full h-64 bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-lg border border-gray-700/50 backdrop-blur-sm overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-pulse"></div>
        <div
          className="absolute top-0 left-0 w-full h-full opacity-30"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
          }}
        ></div>
      </div>

      {/* Loading Animation */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          {/* Spinning Loader */}
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-600/30 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" style={{ animationDelay: '-0.5s' }}></div>
          </div>
          
          {/* Progress Text */}
          <div className="space-y-2">
            <p className="text-gray-300 text-sm font-medium">
              {progress < 10 ? 'Initializing...' :
               progress < 20 ? 'Processing prompt...' :
               progress < 90 ? `Generating In3D.Ai environment ${currentSkyboxIndex + 1} of ${numVariations}...` :
               progress < 100 ? 'Finalizing...' : 'Applying In3D.Ai...'}
            </p>
            <p className="text-gray-400 text-xs">{progress}% complete</p>
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-4 left-4 w-8 h-8 bg-blue-500/20 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
      <div className="absolute top-8 right-6 w-6 h-6 bg-purple-500/20 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute bottom-6 left-8 w-4 h-4 bg-pink-500/20 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-8 right-4 w-5 h-5 bg-indigo-500/20 rounded-full animate-bounce" style={{ animationDelay: '1.5s' }}></div>

      {/* Progress Bar */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
          {/* Animated Glow Effect */}
          <div 
            className="absolute top-0 h-2 w-[100px] bg-gradient-to-r from-transparent via-blue-400/30 to-transparent animate-shimmer"
            style={{ 
              left: `${progress - 10}%`,
              transition: 'left 0.3s ease-out',
              display: progress < 100 ? 'block' : 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingPlaceholder; 