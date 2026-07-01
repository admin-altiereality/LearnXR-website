/**
 * Verified global XR-in-education data points, keyed by country with
 * coordinates for the interactive world adoption map.
 *
 * Figures are reproduced as reported by the cited publisher. Vendor and
 * institution names remain the property of their respective owners.
 */

import type { StatHighlight } from './india';

export interface CountryAdoption {
  id: string;
  country: string;
  /** [longitude, latitude] for react-simple-maps markers. */
  coordinates: [number, number];
  organization: string;
  headline: string;
  /** Before/after or outcome detail as reported. */
  outcome: string;
  metricBefore?: string;
  metricAfter?: string;
  sourceIds: string[];
}

/** Global market + adoption headline stats. */
export const GLOBAL_STATS: StatHighlight[] = [
  {
    id: 'classvr_reach',
    value: '20,000+',
    label: 'Schools across 90+ countries use ClassVR (2M+ students, 250,000 classrooms)',
    sourceIds: ['classvr_iste25', 'classvr_lausd'],
  },
  {
    id: 'pwc_faster',
    value: '4x',
    label: 'Faster training in VR vs classroom (PwC study of 1,600+ managers)',
    sourceIds: ['pwc_vr_study'],
  },
  {
    id: 'pwc_confident',
    value: '275%',
    label: 'More confident to act on what they learned after VR training (PwC)',
    sourceIds: ['pwc_vr_study'],
  },
  {
    id: 'market_size',
    value: '$61.6B',
    label: 'Global AR/VR e-learning services market in 2024, growing ~20.8% CAGR to 2030',
    sourceIds: ['gvr_arvr_elearning'],
  },
];

export const COUNTRY_ADOPTION: CountryAdoption[] = [
  {
    id: 'usa_lausd',
    country: 'United States',
    coordinates: [-118.24, 34.05],
    organization: 'Los Angeles Unified School District',
    headline: '16,000+ ClassVR headsets deployed',
    outcome:
      'LAUSD selected ClassVR to support its Instructional Technology Initiative, deploying more than 16,000 headsets to enhance engagement across the district.',
    sourceIds: ['classvr_lausd'],
  },
  {
    id: 'usa_zspace',
    country: 'United States',
    coordinates: [-98.58, 39.83],
    organization: 'zSpace (3,500+ districts & institutions)',
    headline: 'AR/VR across 3,500+ districts',
    outcome:
      'zSpace reports its AR/VR platform is trusted by over 3,500 school districts, technical centers, community colleges and universities for STEM and CTE.',
    sourceIds: ['zspace_talladega', 'zspace_danbury'],
  },
  {
    id: 'usa_morehouse',
    country: 'United States',
    coordinates: [-84.41, 33.75],
    organization: 'Morehouse College (VictoryXR metaversity)',
    headline: 'Achievement 84% → 94% in VR',
    outcome:
      'Morehouse reported student achievement of 94% in VR classes vs 84% face-to-face/online, with World History II attendance rising to 90%.',
    metricBefore: '84% achievement (traditional)',
    metricAfter: '94% achievement (VR)',
    sourceIds: ['victoryxr_morehouse', 'victoryxr_highered'],
  },
  {
    id: 'uk_classvr',
    country: 'United Kingdom',
    coordinates: [-1.55, 53.0],
    organization: 'Avantis Education / ClassVR (HQ Gloucester)',
    headline: 'Global ClassVR ecosystem',
    outcome:
      'UK-headquartered Avantis Education built ClassVR into a platform serving 2M+ students in 250,000 classrooms across 90+ countries.',
    sourceIds: ['classvr_iste25', 'avantis_growth'],
  },
  {
    id: 'finland_labster',
    country: 'Finland',
    coordinates: [27.0, 62.6],
    organization: 'University of Eastern Finland (Labster)',
    headline: 'Course pass rates +16%',
    outcome:
      'Labster reports student course pass rates increased by 16% after the introduction of its virtual labs at the University of Eastern Finland.',
    metricBefore: 'Baseline pass rate',
    metricAfter: '+16% pass rate',
    sourceIds: ['labster_evidence'],
  },
  {
    id: 'denmark_labster',
    country: 'Denmark',
    coordinates: [9.5, 56.0],
    organization: 'Peer-reviewed study (Labster simulations)',
    headline: '76% higher learning outcomes',
    outcome:
      'A peer-reviewed study found a 76% increase in learning outcomes using a gamified laboratory simulation vs traditional teaching, and 101% when used at home.',
    metricBefore: 'Traditional teaching',
    metricAfter: '+76% learning outcomes',
    sourceIds: ['labster_dtu'],
  },
  {
    id: 'korea_gyeonggi',
    country: 'South Korea',
    coordinates: [127.0, 37.4],
    organization: 'Gyeonggi Provincial Office of Education',
    headline: 'Metaverse learning in ~30% of elementary schools',
    outcome:
      'The Gyeonggi education office reported 396 schools (about 30% of the province\u2019s elementary schools) using its metaverse platform "Highland", with middle-school content piloted in 10 schools.',
    sourceIds: ['korea_gyeonggi', 'korea_herald_metaverse'],
  },
];
