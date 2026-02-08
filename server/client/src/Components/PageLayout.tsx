import type { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  /** Optional extra class for the outer container */
  className?: string;
  /** Optional extra class for the inner max-width container */
  contentClassName?: string;
}

/**
 * Shared page wrapper for homogeneous layout across Dashboard, Lessons, Explore, etc.
 * Use with Sidebar: main content area already has bg-background; this adds consistent padding and max-width.
 */
export function PageLayout({ children, className = '', contentClassName = '' }: PageLayoutProps) {
  return (
    <div className={`min-h-screen bg-background pt-24 pb-8 ${className}`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
