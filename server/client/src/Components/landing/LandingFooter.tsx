import { Link } from 'react-router-dom';
import { LearnXRTypography } from '../LearnXRTypography';
import { footer, PLAY_STORE_URL, SIDEQUEST_URL } from './data/landingContent';

export const LandingFooter = () => {
  const year = new Date().getFullYear();

  return (
    <footer id="footer" className="relative z-10 w-full border-t border-white/10 bg-black/80 backdrop-blur-md">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-2 lg:grid-cols-4 lg:px-12">
        <div className="md:col-span-2 lg:col-span-1">
          <Link to="/" className="inline-block" aria-label="LearnXR home">
            <LearnXRTypography size="small" className="!text-2xl !tracking-[0.12rem]">
              LearnXR
            </LearnXRTypography>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-base">{footer.blurb}</p>
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold text-purple-400 sm:text-xl">Contact Us</h3>
          <p className="mt-4 space-y-1 text-sm leading-relaxed text-white sm:text-base">
            {footer.phones.map((phone) => (
              <span key={phone} className="block">
                {phone}
              </span>
            ))}
          </p>
        </div>

        <div>
          <h3 className="font-display text-lg font-semibold text-purple-400 sm:text-xl">Explore</h3>
          <ul className="mt-4 flex flex-col gap-2">
            {footer.links.map((link) =>
              'href' in link ? (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-white transition-colors hover:text-purple-300 sm:text-base"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                </li>
              ) : (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm text-white transition-colors hover:text-purple-300 sm:text-base"
                  >
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="font-display text-lg font-semibold text-purple-400 sm:text-xl">Address</h3>
            <p className="mt-2 text-sm leading-relaxed text-white sm:text-base">
              {footer.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-purple-400 sm:text-xl">Email Us</h3>
            <a
              href={`mailto:${footer.email}`}
              className="mt-2 inline-block text-sm text-white hover:text-purple-300 sm:text-base"
            >
              {footer.email}
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-8 text-center sm:px-8">
        <p className="mb-4 text-lg font-medium text-white sm:text-xl">Get it on</p>
        <div className="mb-8 flex items-center justify-center gap-8">
          <a
            href={PLAY_STORE_URL}
            className="text-3xl text-white transition-colors hover:text-purple-400"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Google Play"
          >
            <i className="fa-brands fa-android" aria-hidden />
          </a>
          <a
            href={SIDEQUEST_URL}
            className="w-10 transition-opacity hover:opacity-80 sm:w-12"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SideQuest"
          >
            <img src="/img/sidequest.png" alt="SideQuest" loading="lazy" className="h-auto w-full" width={48} height={48} />
          </a>
          <a href="#" className="text-3xl text-white transition-colors hover:text-purple-400" aria-label="App Store">
            <i className="fa-brands fa-apple" aria-hidden />
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/60 sm:text-sm">
          <Link to="/privacy-policy" className="hover:text-purple-300">
            Privacy
          </Link>
          <span className="text-white/30">|</span>
          <Link to="/terms-conditions" className="hover:text-purple-300">
            Terms
          </Link>
          <span className="text-white/30">|</span>
          <span>{footer.copyright.replace('2025', String(year))}</span>
        </div>
      </div>
    </footer>
  );
};
