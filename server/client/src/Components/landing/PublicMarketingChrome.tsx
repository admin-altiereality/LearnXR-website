import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LeadCaptureModal from '../LeadCaptureModal';
import { useAuth } from '../../contexts/AuthContext';
import { LandingFooter } from './LandingFooter';
import { LandingHeader } from './LandingHeader';

/** Guest-facing marketing routes that share landing header/footer chrome. */
export const MARKETING_ROUTES = [
  '/',
  '/careers',
  '/blog',
  '/privacy-policy',
  '/terms-conditions',
  '/refund-policy',
  '/help',
  '/case-studies',
  '/channel-partners',
  '/school',
  '/individual',
] as const;

export const isMarketingRoute = (pathname: string) =>
  (MARKETING_ROUTES as readonly string[]).includes(pathname);

/**
 * Sticky marketing header for public pages other than `/`
 * (landing keeps its overlay header inside the hero).
 */
export const ConditionalMarketingHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [demoOpen, setDemoOpen] = useState(false);

  if (user) return null;
  if (location.pathname === '/') return null;
  if (!isMarketingRoute(location.pathname)) return null;

  return (
    <>
      <LandingHeader
        variant="bar"
        onBookDemo={() => setDemoOpen(true)}
        onLogin={() => navigate('/login')}
      />
      <LeadCaptureModal open={demoOpen} onOpenChange={setDemoOpen} />
    </>
  );
};

/**
 * Full marketing footer for guest public pages.
 * Landing (`/`) renders its own footer inside the fixed page scroller.
 */
export const ConditionalMarketingFooter = () => {
  const location = useLocation();
  const { user } = useAuth();

  if (user) return null;
  if (location.pathname === '/') return null;
  if (!isMarketingRoute(location.pathname)) return null;

  return <LandingFooter />;
};
