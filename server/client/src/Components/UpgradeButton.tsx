import React from 'react';

interface UpgradeButtonProps {
  onClick: () => void;
  variant?: 'header' | 'main' | 'default';
}

export const UpgradeButton: React.FC<UpgradeButtonProps> = ({ 
  onClick, 
  variant = 'default'
}) => {
  const baseStyles = "relative z-10 px-4 py-2 bg-gradient-to-r from-purple-500/50 to-pink-600/50 hover:from-purple-600/60 hover:to-pink-700/60 text-white rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 border border-purple-500/30";
  
  const variantStyles = {
    header: `${baseStyles} text-sm flex items-center space-x-2`,
    main: `${baseStyles} w-full`,
    default: baseStyles
  };

  return (
    <div className="fixed inset-0 isolate z-50 overflow-hidden">
      <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm" />
      <div className="relative min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative">
                <button
                  onClick={onClick}
                  className={variantStyles[variant]}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>Upgrade</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 