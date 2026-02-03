import React from 'react';

interface LearnXRTypographyProps {
  children: React.ReactNode;
  className?: string;
  size?: 'hero' | 'large' | 'medium' | 'small' | 'footer';
  variant?: 'full' | 'learn' | 'xr';
}

/**
 * LearnXR Typography Component
 * Ensures consistent trademark styling across the entire website
 * Font: Rejouice Headline
 * Tracking: 0.9rem (for hero), adjusted for other sizes
 * Colors: White for "Learn", Purple-700 for "XR"
 */
export const LearnXRTypography: React.FC<LearnXRTypographyProps> = ({
  children,
  className = '',
  size = 'medium',
  variant = 'full',
}) => {
  const sizeClasses = {
    hero: 'text-[14rem] tracking-[0.9rem] leading-none',
    large: 'text-[8rem] tracking-[0.6rem] leading-none',
    medium: 'text-[4rem] tracking-[0.4rem] leading-tight',
    small: 'text-[2rem] tracking-[0.2rem] leading-tight',
    footer: 'text-[20vw] tracking-[1rem] leading-none',
  };

  const baseStyle = {
    fontFamily: 'Rejouice Headline, sans-serif',
  };

  if (variant === 'full') {
    // Split LearnXR into Learn (white) and XR (purple)
    const text = String(children);
    const learnPart = text.replace(/XR.*$/i, '');
    const xrPart = text.match(/XR.*$/i)?.[0] || '';

    return (
      <span className={`${sizeClasses[size]} ${className}`} style={baseStyle}>
        <span className="text-white">{learnPart}</span>
        {xrPart && <span className="text-purple-700">{xrPart}</span>}
      </span>
    );
  }

  if (variant === 'learn') {
    return (
      <span className={`${sizeClasses[size]} text-white ${className}`} style={baseStyle}>
        {children}
      </span>
    );
  }

  if (variant === 'xr') {
    return (
      <span className={`${sizeClasses[size]} text-purple-700 ${className}`} style={baseStyle}>
        {children}
      </span>
    );
  }

  return (
    <span className={`${sizeClasses[size]} ${className}`} style={baseStyle}>
      {children}
    </span>
  );
};

/**
 * Utility function to get LearnXR font classes
 */
export const getLearnXRFontClass = (size: 'hero' | 'large' | 'medium' | 'small' | 'footer' = 'medium') => {
  const sizeClasses = {
    hero: 'text-[14rem] tracking-[0.9rem] leading-none',
    large: 'text-[8rem] tracking-[0.6rem] leading-none',
    medium: 'text-[4rem] tracking-[0.4rem] leading-tight',
    small: 'text-[2rem] tracking-[0.2rem] leading-tight',
    footer: 'text-[20vw] tracking-[1rem] leading-none',
  };
  return `${sizeClasses[size]}`;
};

export const learnXRFontStyle = {
  fontFamily: 'Rejouice Headline, sans-serif',
};

/**
 * Professional trademark symbol component
 * Uses proper ™ Unicode character with proper styling
 */
export const TrademarkSymbol = ({ className = '' }: { className?: string }) => (
  <span className={`text-[0.6em] align-super leading-none ${className}`} style={{ fontFamily: 'Arial, sans-serif' }}>
    ™
  </span>
);
