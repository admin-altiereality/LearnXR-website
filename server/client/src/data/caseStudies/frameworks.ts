/**
 * LearnXR Impact Framework content + chart datasets for the Case Studies page.
 *
 * Chart datasets that present third-party research carry sourceIds. The
 * LearnXR Impact Framework pillars describe LearnXR's own capabilities and are
 * not third-party statistics.
 */

import type { StatHighlight } from './india';

export interface FrameworkPillar {
  id: string;
  title: string;
  description: string;
  /** lucide-react icon name used by the UI. */
  icon: string;
}

export interface ComparisonRow {
  dimension: string;
  traditional: string;
  learnxr: string;
}

export interface ChartDatum {
  label: string;
  value: number;
  /** Optional comparison baseline for grouped charts. */
  baseline?: number;
}

export interface SourcedChart {
  id: string;
  title: string;
  caption: string;
  unit: string;
  data: ChartDatum[];
  sourceIds: string[];
}

/** Section 4 — Why LearnXR is relevant to schools. */
export const IMPACT_FRAMEWORK: FrameworkPillar[] = [
  {
    id: 'ai',
    title: 'AI-Assisted Learning',
    description:
      'Generative AI helps teachers build immersive lessons, assessments and 3D assets in minutes instead of weeks.',
    icon: 'Sparkles',
  },
  {
    id: 'self-paced',
    title: 'Self-Paced Learning',
    description:
      'Students explore concepts at their own speed with on-demand XR lessons that adapt to individual progress.',
    icon: 'Gauge',
  },
  {
    id: 'classroom',
    title: 'Classroom XR Learning',
    description:
      'Shared immersive experiences turn abstract topics into memorable, hands-on classroom activities.',
    icon: 'School',
  },
  {
    id: 'tours',
    title: 'Virtual Tours',
    description:
      'Take students anywhere — from the human cell to historical monuments — through 360\u00b0 immersive tours.',
    icon: 'Globe',
  },
  {
    id: 'assessments',
    title: 'Interactive Assessments',
    description:
      'Auto-graded, scenario-based assessments measure applied understanding, not just recall.',
    icon: 'ClipboardCheck',
  },
  {
    id: 'workforce',
    title: 'Future Workforce Readiness',
    description:
      'Early exposure to XR, AI and digital tools prepares learners for an immersive, technology-driven economy.',
    icon: 'Rocket',
  },
];

/** Traditional vs XR comparison (qualitative; framed as LearnXR positioning). */
export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    dimension: 'Engagement',
    traditional: 'Passive listening and reading',
    learnxr: 'Active, immersive participation',
  },
  {
    dimension: 'Retention',
    traditional: 'Forgetting curve after lectures',
    learnxr: 'Experiential memory anchors recall',
  },
  {
    dimension: 'Practical training',
    traditional: 'Limited by labs, cost and safety',
    learnxr: 'Unlimited risk-free virtual practice',
  },
  {
    dimension: 'Accessibility',
    traditional: 'Field trips constrained by geography',
    learnxr: 'Any place or era via virtual tours',
  },
  {
    dimension: 'Personalisation',
    traditional: 'One pace for the whole class',
    learnxr: 'AI-adapted, self-paced pathways',
  },
];

/**
 * Research-backed charts. These reproduce findings from the cited studies to
 * illustrate the documented direction and magnitude of XR learning impact.
 */
export const SOURCED_CHARTS: SourcedChart[] = [
  {
    id: 'pwc_outcomes',
    title: 'VR vs Classroom — PwC enterprise study',
    caption:
      'PwC study of 1,600+ managers: VR learners trained up to 4x faster and were 275% more confident applying skills.',
    unit: 'x / %',
    data: [
      { label: 'Training speed (x faster)', value: 4 },
      { label: 'Confidence uplift (%)', value: 275 },
    ],
    sourceIds: ['pwc_vr_study'],
  },
  {
    id: 'morehouse_achievement',
    title: 'Student achievement — Morehouse metaversity',
    caption:
      'Reported student achievement rose from 84% (face-to-face/online) to 94% in VR classes.',
    unit: '% achievement',
    data: [
      { label: 'Face-to-face', value: 84 },
      { label: 'Online', value: 84 },
      { label: 'VR (Metaversity)', value: 94 },
    ],
    sourceIds: ['victoryxr_morehouse'],
  },
  {
    id: 'labster_gains',
    title: 'Learning outcomes — Labster virtual labs',
    caption:
      'A peer-reviewed study reported a 76% increase in learning outcomes vs traditional teaching, and a +16% course pass rate at the University of Eastern Finland.',
    unit: '% improvement',
    data: [
      { label: 'Learning outcomes', value: 76 },
      { label: 'Course pass rate', value: 16 },
    ],
    sourceIds: ['labster_dtu', 'labster_evidence'],
  },
  {
    id: 'market_growth',
    title: 'Market growth — AR/VR e-learning services',
    caption:
      'Grand View Research valued the global AR/VR e-learning services market at $61.6B in 2024, projected to reach $189.7B by 2030 (~20.8% CAGR).',
    unit: 'USD billion',
    data: [
      { label: '2024', value: 61.6 },
      { label: '2030 (proj.)', value: 189.7 },
    ],
    sourceIds: ['gvr_arvr_elearning'],
  },
];
