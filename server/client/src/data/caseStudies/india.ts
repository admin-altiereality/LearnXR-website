/**
 * Verified India XR-in-education data points.
 *
 * Every entry references a credible source id from sources.ts. Figures are
 * reproduced as reported by the cited publisher; LearnXR makes no proprietary
 * claim over third-party programs or vendors named here.
 */

export interface CaseStudyEntry {
  id: string;
  institution: string;
  category: 'school' | 'college' | 'medical' | 'government' | 'initiative';
  location: string;
  year: number;
  /** Short headline metric, e.g. "10,000 labs". */
  headline: string;
  /** One-line description of the implementation and outcome as reported. */
  detail: string;
  sourceIds: string[];
}

export interface StatHighlight {
  id: string;
  value: string;
  label: string;
  sourceIds: string[];
}

/** Headline statistics for the India section (each maps to an animated StatCard). */
export const INDIA_STATS: StatHighlight[] = [
  {
    id: 'atl_labs',
    value: '10,000',
    label: 'Atal Tinkering Labs established across 722 districts in India',
    sourceIds: ['atl_meta_ftl_bs', 'atl_meta_ftl_print'],
  },
  {
    id: 'ftl_focus',
    value: 'AR / VR',
    label: 'Frontier Technology Labs equip students with AR/VR, AI and robotics skills',
    sourceIds: ['atl_meta_ftl_bs', 'atl_meta_ftl_print'],
  },
  {
    id: 'aiims_cases',
    value: '100+',
    label: 'Neurosurgical cases at AIIMS Delhi planned/rehearsed with VR digital twins',
    sourceIds: ['aiims_immersivetouch'],
  },
];

export const INDIA_CASE_STUDIES: CaseStudyEntry[] = [
  {
    id: 'atl',
    institution: 'Atal Innovation Mission (NITI Aayog)',
    category: 'government',
    location: 'Pan-India (722 districts)',
    year: 2024,
    headline: '10,000 Atal Tinkering Labs',
    detail:
      'NITI Aayog reports 10,000 Atal Tinkering Labs established across 722 districts to build design thinking and computational skills in school students.',
    sourceIds: ['atl_meta_ftl_bs', 'atl_meta_ftl_print'],
  },
  {
    id: 'ftl',
    institution: 'AIM-NITI Aayog & Meta — Frontier Technology Labs',
    category: 'initiative',
    location: 'Schools of strategic importance, India',
    year: 2024,
    headline: 'AR/VR Frontier Technology Labs',
    detail:
      'An advanced version of the Atal Tinkering Lab equipping students to innovate using AI, Augmented & Virtual Reality, blockchain, robotics, 3D printing and IoT.',
    sourceIds: ['atl_meta_ftl_bs', 'atl_meta_ftl_print'],
  },
  {
    id: 'aiims_vr',
    institution: 'AIIMS New Delhi',
    category: 'medical',
    location: 'New Delhi',
    year: 2025,
    headline: 'VR training centre for medical & nursing education',
    detail:
      'AIIMS launched a VR training centre (with MediSim VR) for structured, simulation-based clinical training, enabling risk-free repetitive practice and standardised assessment.',
    sourceIds: ['aiims_medisim', 'aiims_vr_centre'],
  },
  {
    id: 'aiims_neuro',
    institution: 'AIIMS New Delhi — Department of Neurosurgery',
    category: 'medical',
    location: 'New Delhi',
    year: 2024,
    headline: '100+ cases planned with VR digital twins',
    detail:
      'Using the ImmersiveTouch platform, AIIMS converted 2D scans into patient-specific 3D digital twins; more than 100 cases were planned and rehearsed in VR before surgery.',
    sourceIds: ['aiims_immersivetouch'],
  },
];
