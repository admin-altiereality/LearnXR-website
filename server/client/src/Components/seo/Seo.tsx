import { Helmet } from 'react-helmet-async';

export interface SeoProps {
  title: string;
  description: string;
  /** Path-only canonical (e.g. "/case-studies"); origin is prepended at runtime. */
  path?: string;
  /** Absolute or root-relative OG image URL. */
  image?: string;
  type?: 'website' | 'article';
  /** Set true to discourage indexing (e.g. preview-only pages). */
  noIndex?: boolean;
}

const SITE_NAME = 'LearnXR';
const DEFAULT_IMAGE = '/img/altierealitylogo.png';

const resolveOrigin = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://altiereality.com';
};

/**
 * Per-page document head manager (title, description, canonical, Open Graph,
 * Twitter). Improves shared-link/social previews. Note: full crawler SEO for
 * this client-rendered SPA would additionally require SSR/prerendering.
 */
export const Seo = ({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = 'website',
  noIndex = false,
}: SeoProps) => {
  const origin = resolveOrigin();
  const canonical = path ? `${origin}${path}` : undefined;
  const absoluteImage = image.startsWith('http') ? image : `${origin}${image}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={absoluteImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />
    </Helmet>
  );
};

export default Seo;
