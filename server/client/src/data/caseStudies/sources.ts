/**
 * Central citation registry for the XR Case Studies & Research Hub.
 *
 * Every statistic shown in the UI references a `Source` by id. Only claims that
 * can be attributed to a credible, publicly accessible URL are included.
 * Anything that could not be independently verified is intentionally omitted
 * (see docs/research/xr-education-research.md for the gap list).
 */

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  year: number;
  /** ISO date the source was last accessed/verified. */
  accessed: string;
}

const ACCESSED = '2026-06-21';

export const SOURCES: Record<string, Source> = {
  classvr_iste25: {
    id: 'classvr_iste25',
    title: 'ClassVR from Avantis Education Wins Tech & Learning Best of Show Award at ISTELive 25',
    publisher: 'EdCircuit',
    url: 'https://edcircuit.com/press_releases/classvr-from-avantis-education-wins-tech-learning-best-of-show-award-at-istelive-25/',
    year: 2025,
    accessed: ACCESSED,
  },
  classvr_lausd: {
    id: 'classvr_lausd',
    title: 'Los Angeles Unified School District Chooses ClassVR from Avantis Education',
    publisher: 'eSchool News',
    url: 'https://www.eschoolnews.com/newsline/2024/10/25/los-angeles-unified-school-district-chooses-classvr-from-avantis-education-to-bring-immersive-virtual-reality-learning-to-students/',
    year: 2024,
    accessed: ACCESSED,
  },
  avantis_growth: {
    id: 'avantis_growth',
    title: 'Avantis targets 50% growth for ClassVR tech in US in 2024',
    publisher: 'Installation International',
    url: 'https://www.installation-international.com/technology/ed-tech/avantis-targets-50-growth-for-classvr-tech-in-us-in-2024',
    year: 2024,
    accessed: ACCESSED,
  },
  pwc_vr_study: {
    id: 'pwc_vr_study',
    title: 'How virtual reality is redefining soft skills training',
    publisher: 'PwC (US)',
    url: 'https://www.pwc.com/us/en/tech-effect/emerging-tech/virtual-reality-study.html',
    year: 2020,
    accessed: ACCESSED,
  },
  atl_meta_ftl_bs: {
    id: 'atl_meta_ftl_bs',
    title: 'AIM, Meta partner to establish Frontier Technology Labs in schools',
    publisher: 'Business Standard',
    url: 'https://www.business-standard.com/education/news/aim-meta-partner-to-establish-frontier-technology-labs-in-schools-124030600855_1.html',
    year: 2024,
    accessed: ACCESSED,
  },
  atl_meta_ftl_print: {
    id: 'atl_meta_ftl_print',
    title: "Meta, NITI Aayog join hands to set up 'Frontier Tech Labs' in 'schools of strategic importance'",
    publisher: 'ThePrint',
    url: 'https://theprint.in/india/meta-niti-aayog-join-hands-to-set-up-frontier-tech-labs-in-schools-of-strategic-importance/1990690/',
    year: 2024,
    accessed: ACCESSED,
  },
  aiims_medisim: {
    id: 'aiims_medisim',
    title: 'AIIMS New Delhi partners with MediSim VR to drive adoption of VR skill training in medical education',
    publisher: 'Express Healthcare',
    url: 'https://www.expresshealthcare.in/news/aiims-new-delhi-partners-with-medisim-vr-to-drive-adoption-of-vr-skill-training-in-medical-education/453297/',
    year: 2025,
    accessed: ACCESSED,
  },
  aiims_vr_centre: {
    id: 'aiims_vr_centre',
    title: 'AIIMS New Delhi launches Virtual Reality training centre for medical students',
    publisher: 'Medical Dialogues',
    url: 'https://medicaldialogues.in/news/education/aiims-new-delhi-launches-virtual-reality-training-centre-for-medical-students-168141',
    year: 2025,
    accessed: ACCESSED,
  },
  aiims_immersivetouch: {
    id: 'aiims_immersivetouch',
    title: 'Delhi AIIMS unveils groundbreaking initiatives to revolutionize neurosurgical education',
    publisher: 'Medical Dialogues',
    url: 'https://medicaldialogues.in/news/health/hospital-diagnostics/delhi-aiims-unveils-groundbreaking-initiatives-to-revolutionize-neurosurgical-education-126453',
    year: 2024,
    accessed: ACCESSED,
  },
  victoryxr_highered: {
    id: 'victoryxr_highered',
    title: 'Higher Education AI Tutor Platform & VR Labs',
    publisher: 'VictoryXR',
    url: 'https://www.victoryxr.com/higher-education/',
    year: 2024,
    accessed: ACCESSED,
  },
  victoryxr_morehouse: {
    id: 'victoryxr_morehouse',
    title: 'Morehouse College Digital Twin Results',
    publisher: 'VictoryXR',
    url: 'https://www.victoryxr.com/morehouse-results/',
    year: 2024,
    accessed: ACCESSED,
  },
  baton_victoryxr: {
    id: 'baton_victoryxr',
    title: 'Teaching & Learning with Virtual Reality: VictoryXR Research Summary',
    publisher: 'Bâton Global',
    url: 'https://www.batonglobal.com/post/teaching-learning-with-virtual-reality-victoryxr-research-summary',
    year: 2023,
    accessed: ACCESSED,
  },
  labster_evidence: {
    id: 'labster_evidence',
    title: 'Labster Virtual Labs - Evidence for Effectiveness',
    publisher: 'Labster',
    url: 'https://www.labster.com/guides/evidence-labster-virtual-labs-work',
    year: 2024,
    accessed: ACCESSED,
  },
  labster_dtu: {
    id: 'labster_dtu',
    title: 'Improving biotech education through gamified laboratory simulations',
    publisher: 'Nature Biotechnology (via DTU Orbit)',
    url: 'https://backend.orbit.dtu.dk/ws/portalfiles/portal/105633882/Improving_biotech_education.pdf',
    year: 2014,
    accessed: ACCESSED,
  },
  zspace_danbury: {
    id: 'zspace_danbury',
    title: 'Danbury Public Schools Deploys Immersive AR/VR Technology Across District',
    publisher: 'Nasdaq / GlobeNewswire',
    url: 'https://www.nasdaq.com/press-release/danbury-public-schools-deploys-immersive-ar-vr-technology-across-district-bringing-ai',
    year: 2025,
    accessed: ACCESSED,
  },
  zspace_talladega: {
    id: 'zspace_talladega',
    title: 'Talladega County Schools Drive Innovation with zSpace Mobile AR/VR Lab',
    publisher: 'PR Newswire',
    url: 'https://www.prnewswire.com/news-releases/talladega-county-schools-drive-innovation-with-zspace-mobile-arvr-lab-302180324.html',
    year: 2024,
    accessed: ACCESSED,
  },
  zspace_cumberland: {
    id: 'zspace_cumberland',
    title: 'Districtwide Launch of Augmented/Virtual Reality Computers in Cumberland County Schools',
    publisher: 'PR Newswire',
    url: 'https://www.prnewswire.com/news-releases/teamwork-and-strategic-planning-pave-the-way-for-seamless-districtwide-launch-of-augmentedvirtual-reality-computers-in-cumberland-county-schools-301969609.html',
    year: 2023,
    accessed: ACCESSED,
  },
  gvr_arvr_elearning: {
    id: 'gvr_arvr_elearning',
    title: 'Augmented Reality & Virtual Reality - E-learning services market outlook',
    publisher: 'Grand View Research',
    url: 'https://www.grandviewresearch.com/horizon/statistics/e-learning-services-market/technology/augmented-reality-virtual-reality/global',
    year: 2024,
    accessed: ACCESSED,
  },
  gvr_metaverse_edu: {
    id: 'gvr_metaverse_edu',
    title: 'Metaverse In Education Market Size And Share Report, 2030',
    publisher: 'Grand View Research',
    url: 'https://www.grandviewresearch.com/industry-analysis/metaverse-education-market-report',
    year: 2024,
    accessed: ACCESSED,
  },
  korea_gyeonggi: {
    id: 'korea_gyeonggi',
    title: 'Gyeonggi Provincial Office of Education metaverse platform "Highland"',
    publisher: 'Maeil Business Newspaper (MK)',
    url: 'https://www.mk.co.kr/en/society/11245733',
    year: 2025,
    accessed: ACCESSED,
  },
  korea_herald_metaverse: {
    id: 'korea_herald_metaverse',
    title: 'Korea aims to become 5th-largest metaverse market by 2026',
    publisher: 'The Korea Herald',
    url: 'https://m.koreaherald.com/article/2768051',
    year: 2022,
    accessed: ACCESSED,
  },
  nep_2020: {
    id: 'nep_2020',
    title: 'National Education Policy 2020',
    publisher: 'Ministry of Education, Government of India',
    url: 'https://www.education.gov.in/sites/upload_files/mhrd/files/NEP_Final_English_0.pdf',
    year: 2020,
    accessed: ACCESSED,
  },
};

export const getSource = (id: string): Source | undefined => SOURCES[id];

export const allSources = (): Source[] => Object.values(SOURCES);
