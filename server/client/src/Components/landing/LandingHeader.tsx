import { Link } from 'react-router-dom';
import { LearnXRTypography } from '../LearnXRTypography';
import { navLinks } from './data/landingContent';
import { MagneticButton } from './ui/MagneticButton';

interface LandingHeaderProps {
  onBookDemo: () => void;
  onLogin: () => void;
  /** `overlay` sits on hero media; `bar` is a sticky top chrome for other marketing pages */
  variant?: 'overlay' | 'bar';
}

export const LandingHeader = ({ onBookDemo, onLogin, variant = 'overlay' }: LandingHeaderProps) => (
  <header
    className={
      variant === 'bar'
        ? 'sticky top-0 z-50 w-full border-b border-white/10 bg-black/70 backdrop-blur-lg'
        : 'relative z-20 w-full'
    }
  >
    <nav
      className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8 md:px-10 lg:px-12"
      aria-label="Primary"
    >
      <Link to="/" className="flex min-w-0 shrink items-center gap-1" aria-label="LearnXR home">
        <LearnXRTypography size="small" className="!text-2xl !tracking-[0.12rem] sm:!text-3xl sm:!tracking-[0.18rem]">
          LearnXR
        </LearnXRTypography>
      </Link>

      <div className="flex max-w-[70%] flex-wrap items-center justify-end gap-2 sm:max-w-none sm:gap-3">
        {navLinks.map((item) => {
          if (item.kind === 'demo') {
            return (
              <MagneticButton key={item.label} variant="ghost" onClick={onBookDemo} className="!px-3 !py-2 sm:!px-5">
                {item.label}
              </MagneticButton>
            );
          }
          if (item.kind === 'login') {
            return (
              <MagneticButton key={item.label} variant="primary" onClick={onLogin} className="!px-3 !py-2 sm:!px-6">
                {item.label}
              </MagneticButton>
            );
          }
          return (
            <Link
              key={item.label}
              to={item.to}
              className="rounded-2xl border border-white/30 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:px-5 sm:text-base"
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  </header>
);
