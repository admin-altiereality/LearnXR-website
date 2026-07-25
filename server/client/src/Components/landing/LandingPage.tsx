import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LeadCaptureModal from '../LeadCaptureModal';
import { useAuth } from '../../contexts/AuthContext';
import { LandingFooter } from './LandingFooter';
import { AILearningSection } from './sections/AILearningSection';
import { CompanyActivitySection } from './sections/CompanyActivitySection';
import { ContentShowcaseSection } from './sections/ContentShowcaseSection';
import { CTASection } from './sections/CTASection';
import { FAQSection } from './sections/FAQSection';
import { FeaturesBentoSection } from './sections/FeaturesBentoSection';
import { HeroSection } from './sections/HeroSection';
import { HowItWorksSection } from './sections/HowItWorksSection';
import { ImpactProofSection } from './sections/ImpactProofSection';
import { TrustedBySection } from './sections/TrustedBySection';
import { WhyLearnXRSection } from './sections/WhyLearnXRSection';
import { XRClassroomSection } from './sections/XRClassroomSection';
import './landing.css';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  useEffect(() => {
    const classNames = ['landing-page-active'];
    document.documentElement.classList.add(...classNames);
    document.body.classList.add(...classNames);
    return () => {
      document.documentElement.classList.remove(...classNames);
      document.body.classList.remove(...classNames);
    };
  }, []);

  useEffect(() => {
    if (authLoading || user) return;

    try {
      if (
        sessionStorage.getItem('learnxr-lead-captured') === '1' ||
        sessionStorage.getItem('learnxr-lead-popup-dismissed') === '1'
      ) {
        return;
      }
    } catch {
      // Ignore storage issues and continue with the timer-based popup.
    }

    const timer = window.setTimeout(() => {
      setIsLeadModalOpen(true);
    }, 30000);

    return () => window.clearTimeout(timer);
  }, [authLoading, user]);

  const handleLogin = () => navigate('/login');
  const handleBookDemo = () => setIsLeadModalOpen(true);

  return (
    <div className="landing-root fixed inset-0 z-30 min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden overflow-y-auto bg-[#050816] text-white">
      <main className="landing-main relative z-10 w-full">
        <HeroSection onBookDemo={handleBookDemo} onLogin={handleLogin} />
        <TrustedBySection />
        <WhyLearnXRSection />
        <HowItWorksSection />
        <AILearningSection />
        <XRClassroomSection />
        <ImpactProofSection />
        <FAQSection />
        <FeaturesBentoSection />
        <ContentShowcaseSection />
        <CompanyActivitySection />
        <CTASection onBookDemo={handleBookDemo} />
        <LandingFooter />
      </main>

      <LeadCaptureModal open={isLeadModalOpen} onOpenChange={setIsLeadModalOpen} />
    </div>
  );
};

export default LandingPage;
