import { Link } from 'react-router-dom';
import { learnXRFontStyle } from './LearnXRTypography';

const LogoHeader = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-black/50 backdrop-blur-lg border-b border-white/10">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-2xl font-bold tracking-tight" style={learnXRFontStyle}>
          <span className="text-white">Learn</span>
          <span className="text-primary">XR</span>
        </span>
      </Link>
      <nav className="flex items-center gap-4 sm:gap-6">
        <Link to="/case-studies" className="text-sm text-white/70 hover:text-white transition-colors">
          Case Studies
        </Link>
        <Link to="/channel-partners" className="text-sm text-white/70 hover:text-white transition-colors">
          Partners
        </Link>
        <Link to="/login" className="text-sm text-white/70 hover:text-white transition-colors">
          Login
        </Link>
      </nav>
    </header>
  );
};

export default LogoHeader;
