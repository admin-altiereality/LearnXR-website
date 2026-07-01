/**
 * Static content for the Channel Partner Program page.
 * No third-party statistics here — this is LearnXR program content.
 */

export interface PartnerBenefit {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface PartnerType {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface ProgramHighlight {
  value: string;
  label: string;
}

export const PARTNER_BENEFITS: PartnerBenefit[] = [
  {
    id: 'revenue',
    title: 'Attractive Revenue Share',
    description:
      'Earn competitive margins on every licence and renewal, with volume-based incentives as you grow.',
    icon: 'TrendingUp',
  },
  {
    id: 'exclusivity',
    title: 'Territory Exclusivity',
    description:
      'Qualifying partners receive protected territories so you can invest in your market with confidence.',
    icon: 'MapPinned',
  },
  {
    id: 'training',
    title: 'Training & Enablement',
    description:
      'Hands-on onboarding, sales playbooks, and technical training to get your team selling fast.',
    icon: 'GraduationCap',
  },
  {
    id: 'marketing',
    title: 'Marketing Support',
    description:
      'Co-branded assets, campaign templates, and lead-generation support to build local demand.',
    icon: 'Megaphone',
  },
  {
    id: 'demo',
    title: 'Demo & Trial Access',
    description:
      'Full platform access for demonstrations, pilots, and proof-of-concept deployments.',
    icon: 'MonitorPlay',
  },
  {
    id: 'certification',
    title: 'Partner Certification',
    description:
      'Become a certified LearnXR partner and stand out with recognised credentials.',
    icon: 'BadgeCheck',
  },
];

export const PARTNER_TYPES: PartnerType[] = [
  {
    id: 'school',
    title: 'School Partners',
    description: 'Individual schools championing immersive learning for their students.',
    icon: 'School',
  },
  {
    id: 'district',
    title: 'District & Group Partners',
    description: 'School groups and districts rolling out XR across multiple campuses.',
    icon: 'Building2',
  },
  {
    id: 'distributor',
    title: 'Distributors & Resellers',
    description: 'Education technology distributors expanding their immersive portfolio.',
    icon: 'Truck',
  },
  {
    id: 'technology',
    title: 'Technology Partners',
    description: 'Hardware, LMS, and platform providers integrating with LearnXR.',
    icon: 'Cpu',
  },
  {
    id: 'international',
    title: 'International Partners',
    description: 'Regional partners bringing LearnXR to new countries and languages.',
    icon: 'Globe2',
  },
  {
    id: 'government',
    title: 'Government & Institutional',
    description: 'Public bodies and institutions deploying XR at programme scale.',
    icon: 'Landmark',
  },
];

export const PROGRAM_HIGHLIGHTS: ProgramHighlight[] = [
  { value: 'AI-assisted', label: 'Immersive content creation built in' },
  { value: 'Web + VR', label: 'Runs in the browser and on headsets' },
  { value: 'Curriculum', label: 'Aligned, classroom-ready lessons' },
  { value: 'Co-selling', label: 'Dedicated partner enablement' },
];

/** Markets for the global reach map: type 'current' vs 'expansion'. */
export interface PartnerMarket {
  id: string;
  name: string;
  coordinates: [number, number];
  type: 'current' | 'expansion';
}

export const PARTNER_MARKETS: PartnerMarket[] = [
  { id: 'in', name: 'India', coordinates: [78.96, 20.59], type: 'current' },
  { id: 'ae', name: 'United Arab Emirates', coordinates: [54.0, 24.0], type: 'expansion' },
  { id: 'sg', name: 'Singapore', coordinates: [103.82, 1.35], type: 'expansion' },
  { id: 'uk', name: 'United Kingdom', coordinates: [-1.55, 53.0], type: 'expansion' },
  { id: 'us', name: 'United States', coordinates: [-98.58, 39.83], type: 'expansion' },
  { id: 'au', name: 'Australia', coordinates: [133.78, -25.27], type: 'expansion' },
  { id: 'za', name: 'South Africa', coordinates: [24.0, -29.0], type: 'expansion' },
];

export const PARTNER_TYPE_OPTIONS = PARTNER_TYPES.map((t) => ({ value: t.id, label: t.title }));

export const ORG_TYPE_OPTIONS = [
  { value: 'school', label: 'School' },
  { value: 'school_group', label: 'School Group / District' },
  { value: 'distributor', label: 'Distributor / Reseller' },
  { value: 'edtech', label: 'EdTech Company' },
  { value: 'system_integrator', label: 'System Integrator' },
  { value: 'government', label: 'Government / Public Body' },
  { value: 'other', label: 'Other' },
];

export const REACH_OPTIONS = [
  { value: '1', label: '1 school' },
  { value: '2-10', label: '2–10 schools' },
  { value: '11-50', label: '11–50 schools' },
  { value: '51-200', label: '51–200 schools' },
  { value: '200+', label: '200+ schools' },
];

export const EXPERIENCE_OPTIONS = [
  { value: '0-1', label: 'Less than 1 year' },
  { value: '1-3', label: '1–3 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '5-10', label: '5–10 years' },
  { value: '10+', label: '10+ years' },
];
