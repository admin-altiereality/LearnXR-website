import { useEffect, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface SmoothScrollProps {
  children: ReactNode;
}

/**
 * SmoothScroll component provides smooth scrolling behavior throughout the app.
 * It uses native CSS smooth scrolling with enhanced scroll-to-top on route changes.
 */
const SmoothScroll = ({ children }: SmoothScrollProps) => {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top on route change with smooth animation
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [location.pathname]);

  // Handle anchor link smooth scrolling
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const element = document.querySelector(href);
          if (element) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <div ref={scrollRef} className="smooth-scroll-container">
      {children}
    </div>
  );
};

export default SmoothScroll;

