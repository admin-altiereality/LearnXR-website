/**
 * Structured content for the downloadable LearnXR reports.
 *
 * Editorial rules:
 *  - Every quantitative claim references a verified Source id (see sources.ts)
 *    and is surfaced in the report's "Sources & references" page.
 *  - Body copy intentionally avoids naming commercial vendors/products; it uses
 *    generic descriptors (e.g. "a leading classroom XR platform", "VR labs").
 *    Government programmes and public institutions may be named.
 *  - The Sources page retains the real publisher names and URLs so that every
 *    figure remains independently verifiable.
 */

export interface ReportStat {
  value: string;
  label: string;
  sourceIds?: string[];
}

export type CitedText = string | { text: string; sourceIds?: string[] };

export interface ReportTableRow {
  cells: string[];
  sourceIds?: string[];
}

export interface ReportTable {
  columns: string[];
  /** Relative column widths (flex). Defaults to equal widths. */
  widths?: number[];
  rows: ReportTableRow[];
  note?: string;
}

export interface ReportFigureBar {
  label: string;
  value: number;
  /** Human-readable value rendered next to the bar, e.g. "$61.6B". */
  display: string;
  sourceIds?: string[];
}

export interface ReportFigure {
  title?: string;
  unit?: string;
  bars: ReportFigureBar[];
  caption?: string;
}

export interface ReportCallout {
  title?: string;
  items: string[];
}

export type ReportBlock =
  | { type: 'lead'; text: string; sourceIds?: string[] }
  | { type: 'paragraph'; text: string; sourceIds?: string[] }
  | { type: 'subheading'; text: string }
  | { type: 'bullets'; items: CitedText[] }
  | { type: 'stats'; items: ReportStat[] }
  | { type: 'table'; table: ReportTable }
  | { type: 'figure'; figure: ReportFigure }
  | { type: 'callout'; callout: ReportCallout };

export interface ReportSection {
  heading: string;
  blocks: ReportBlock[];
}

export interface ReportDefinition {
  id: 'india' | 'global' | 'future';
  fileName: string;
  kicker: string;
  title: string;
  subtitle: string;
  intro: string;
  toc: string[];
  sections: ReportSection[];
  /** Ordered source ids; drives both citation numbering and the Sources page. */
  sourceIds: string[];
}

/* ------------------------------------------------------------------ */
/* INDIA REPORT                                                        */
/* ------------------------------------------------------------------ */

export const INDIA_REPORT: ReportDefinition = {
  id: 'india',
  fileName: 'LearnXR-India-XR-Education-Report.pdf',
  kicker: 'LearnXR Research',
  title: 'XR in Education: The India Report',
  subtitle:
    'How immersive learning is moving from pilot projects to mainstream classrooms, campuses, and medical institutions across India.',
  intro:
    'India is assembling one of the world\u2019s largest innovation-education footprints. National policy now explicitly encourages technology-enabled, experiential learning; tens of thousands of school innovation labs are operational; and flagship medical institutions are using virtual reality for standardised clinical training and patient-specific surgical rehearsal. This report consolidates verified, publicly reported developments, quantifies the opportunity, and outlines where an AI-assisted immersive learning platform such as LearnXR fits. Every figure is attributed to a credible public source listed at the end of this document.',
  toc: [
    'Executive summary',
    'Policy foundation: NEP 2020',
    'National innovation infrastructure',
    'Higher & medical education',
    'Market & investment outlook',
    'The LearnXR opportunity',
    'Methodology & verification',
    'Sources & references',
  ],
  sections: [
    {
      heading: 'Executive summary',
      blocks: [
        {
          type: 'lead',
          text: 'Immersive technology in Indian education has crossed the line from experiment to infrastructure, driven by national policy, large-scale school programmes, and clinical adoption at premier institutions.',
        },
        {
          type: 'callout',
          title: 'Key takeaways',
          items: [
            'National policy (NEP 2020) mandates technology-enabled, experiential and competency-based learning at every level.',
            'A nationwide network of school innovation labs already introduces AR/VR, AI and robotics to students across hundreds of districts.',
            'Premier medical institutions have operationalised VR for standardised training and patient-specific surgical planning.',
            'The global AR/VR e-learning services market is on a ~20.8% CAGR trajectory through 2030, and India is a priority growth geography.',
          ],
        },
        {
          type: 'stats',
          items: [
            {
              value: '10,000',
              label: 'School innovation labs established across 722 districts',
              sourceIds: ['atl_meta_ftl_bs', 'atl_meta_ftl_print'],
            },
            {
              value: 'AR / VR',
              label: 'Frontier Technology Labs equip students with AR/VR, AI and robotics skills',
              sourceIds: ['atl_meta_ftl_bs', 'atl_meta_ftl_print'],
            },
            {
              value: '100+',
              label: 'Neurosurgical cases planned/rehearsed with VR digital twins at a premier institute',
              sourceIds: ['aiims_immersivetouch'],
            },
            {
              value: '$61.6B',
              label: 'Global AR/VR e-learning services market in 2024 (India a priority geography)',
              sourceIds: ['gvr_arvr_elearning'],
            },
          ],
        },
      ],
    },
    {
      heading: 'Policy foundation: NEP 2020',
      blocks: [
        {
          type: 'paragraph',
          text: 'India\u2019s National Education Policy 2020 reframes the goals of schooling around competency, critical thinking and experiential learning rather than rote memorisation. It explicitly calls for the integration of technology in teaching and learning, the promotion of practical, hands-on pedagogy, and the development of skills for an increasingly digital economy.',
          sourceIds: ['nep_2020'],
        },
        {
          type: 'paragraph',
          text: 'For immersive learning, three policy threads matter most: the shift to experiential and activity-based pedagogy, the emphasis on foundational and higher-order digital skills, and the encouragement of innovative classroom tools. Together they create direct policy cover for AR/VR, simulations and virtual tours as mainstream teaching methods rather than novelties.',
          sourceIds: ['nep_2020'],
        },
        {
          type: 'callout',
          title: 'Why this matters for XR',
          items: [
            'Experiential learning is named as a core pedagogy \u2014 immersive lessons are a natural fit.',
            'Competency-based assessment rewards applied understanding, which scenario-based XR assessments measure well.',
            'Digital-skilling goals align with early, structured exposure to AR/VR and AI tools.',
          ],
        },
      ],
    },
    {
      heading: 'National innovation infrastructure',
      blocks: [
        {
          type: 'paragraph',
          text: 'Public initiatives are seeding immersive and emerging-technology skills from the school level upward. A nationwide programme of tinkering labs has built design-thinking and computational-skills capacity at scale, and a newer, advanced lab format adds frontier technologies including AR/VR.',
        },
        {
          type: 'table',
          table: {
            columns: ['Programme', 'Scale / focus', 'What students do'],
            widths: [1.2, 1.2, 1.6],
            rows: [
              {
                cells: [
                  'School tinkering labs',
                  '10,000 labs across 722 districts',
                  'Design thinking, computational and making skills',
                ],
                sourceIds: ['atl_meta_ftl_bs', 'atl_meta_ftl_print'],
              },
              {
                cells: [
                  'Frontier Technology Labs',
                  'Schools of strategic importance',
                  'AR/VR, AI, blockchain, robotics, 3D printing, IoT',
                ],
                sourceIds: ['atl_meta_ftl_bs', 'atl_meta_ftl_print'],
              },
            ],
            note: 'Figures reproduced as reported by the cited publishers.',
          },
        },
        {
          type: 'paragraph',
          text: 'The significance is structural: a generation of students is gaining first exposure to immersive and emerging technologies inside the public school system. This lowers the adoption curve for curriculum-aligned XR content that can run on the same hardware and skills base.',
        },
      ],
    },
    {
      heading: 'Higher & medical education',
      blocks: [
        {
          type: 'paragraph',
          text: 'India\u2019s flagship medical institutions are among the most advanced adopters of VR for training. A premier national institute has established a dedicated VR training centre for structured, simulation-based clinical education \u2014 enabling risk-free, repeatable practice and standardised assessment for medical and nursing students.',
          sourceIds: ['aiims_medisim', 'aiims_vr_centre'],
        },
        {
          type: 'paragraph',
          text: 'In neurosurgery, the same institution has used a surgical-planning VR platform to convert 2D scans into patient-specific 3D "digital twins". More than 100 cases were planned and rehearsed in virtual reality before surgery, illustrating how immersive simulation moves from teaching aid to clinical workflow.',
          sourceIds: ['aiims_immersivetouch'],
        },
        {
          type: 'table',
          table: {
            columns: ['Use case', 'Reported outcome'],
            widths: [1.4, 1.6],
            rows: [
              {
                cells: [
                  'VR clinical-training centre',
                  'Structured, simulation-based training with risk-free repetition and standardised assessment',
                ],
                sourceIds: ['aiims_medisim', 'aiims_vr_centre'],
              },
              {
                cells: [
                  'Patient-specific surgical rehearsal',
                  '100+ neurosurgical cases planned/rehearsed using 3D digital twins',
                ],
                sourceIds: ['aiims_immersivetouch'],
              },
            ],
          },
        },
        {
          type: 'paragraph',
          text: 'Clinical adoption is a leading indicator. Where VR meets the bar for high-stakes medical training, the case for using the same immersive methods in schools and colleges \u2014 where stakes and costs are lower \u2014 becomes straightforward.',
        },
      ],
    },
    {
      heading: 'Market & investment outlook',
      blocks: [
        {
          type: 'paragraph',
          text: 'The commercial backdrop is expansionary. The global market for AR/VR e-learning services was valued at USD 61.6 billion in 2024 and is projected to reach USD 189.7 billion by 2030, a compound annual growth rate of roughly 20.8%. India, with its scale, policy push and young population, is consistently identified as a priority growth geography within this market.',
          sourceIds: ['gvr_arvr_elearning'],
        },
        {
          type: 'figure',
          figure: {
            title: 'Global AR/VR e-learning services market',
            unit: 'USD billion',
            bars: [
              { label: '2024', value: 61.6, display: '$61.6B', sourceIds: ['gvr_arvr_elearning'] },
              { label: '2030 (projected)', value: 189.7, display: '$189.7B', sourceIds: ['gvr_arvr_elearning'] },
            ],
            caption: 'Approx. 20.8% CAGR, 2024\u20132030 (Grand View Research).',
          },
        },
        {
          type: 'paragraph',
          text: 'Two forces compress the adoption timeline further: falling hardware costs (affordable standalone headsets and browser-based WebXR remove the need for tethered, high-end PCs), and generative AI, which collapses the time and cost of authoring immersive content. Together they make classroom-scale XR economically practical for the first time.',
        },
      ],
    },
    {
      heading: 'The LearnXR opportunity',
      blocks: [
        {
          type: 'paragraph',
          text: 'LearnXR complements national efforts with an AI-assisted, curriculum-aligned immersive learning platform built for Indian classrooms. Where public programmes build labs and skills, LearnXR supplies the lessons, assessments and 3D content that run on them \u2014 generated quickly with AI and delivered on affordable, web-based XR.',
        },
        {
          type: 'subheading',
          text: 'How LearnXR maps to documented needs',
        },
        {
          type: 'bullets',
          items: [
            'AI-Assisted Learning: teachers build immersive lessons, assessments and 3D assets in minutes instead of weeks.',
            'Self-Paced Learning: on-demand XR lessons adapt to each student\u2019s progress.',
            'Classroom XR Learning: shared immersive experiences turn abstract topics into hands-on activities.',
            'Virtual Tours: 360\u00b0 immersive tours take students anywhere, from a human cell to historical monuments.',
            'Interactive Assessments: auto-graded, scenario-based assessments measure applied understanding.',
            'Future Workforce Readiness: early exposure to XR, AI and digital tools prepares learners for a technology-driven economy.',
          ],
        },
        {
          type: 'callout',
          title: 'The strategic fit',
          items: [
            'Policy demand (NEP 2020) + installed lab base = ready distribution for curriculum XR.',
            'AI authoring keeps per-lesson cost low, matching public-budget realities.',
            'Web-based delivery runs on the affordable hardware already entering schools.',
          ],
        },
      ],
    },
    {
      heading: 'Methodology & verification',
      blocks: [
        {
          type: 'paragraph',
          text: 'This report follows a verified-only standard. Every quantitative claim is reproduced as reported by a credible, publicly accessible source and is listed, with its URL, on the Sources page. Figures attributed to government programmes, institutions and research are presented as published; LearnXR makes no proprietary claim over third-party programmes, institutions or tools referenced here.',
        },
        {
          type: 'paragraph',
          text: 'To preserve neutrality, body copy describes commercial deployments generically (for example, "a surgical-planning VR platform") while the Sources page retains the original publisher names and links for independent verification. Claims that could not be independently verified at the time of writing were intentionally excluded.',
        },
      ],
    },
  ],
  sourceIds: [
    'nep_2020',
    'atl_meta_ftl_bs',
    'atl_meta_ftl_print',
    'aiims_medisim',
    'aiims_vr_centre',
    'aiims_immersivetouch',
    'gvr_arvr_elearning',
    'pwc_vr_study',
  ],
};

/* ------------------------------------------------------------------ */
/* GLOBAL REPORT                                                       */
/* ------------------------------------------------------------------ */

export const GLOBAL_REPORT: ReportDefinition = {
  id: 'global',
  fileName: 'LearnXR-Global-XR-Education-Report.pdf',
  kicker: 'LearnXR Research',
  title: 'XR in Education: The Global Report',
  subtitle:
    'Evidence of measurable learning impact from immersive education deployments across the Americas, Europe and Asia-Pacific.',
  intro:
    'Across continents, schools, universities and training providers report consistent gains from immersive learning: faster training, higher engagement, and improved measured outcomes. This report compiles verified, publicly reported figures from named public institutions and peer-reviewed studies, organises them by region, and quantifies the market trajectory. To keep the analysis vendor-neutral, commercial platforms are described generically in the body; the Sources page lists every original publisher and URL.',
  toc: [
    'Executive summary',
    'Market sizing',
    'What the research shows',
    'Documented outcomes by region',
    'Adoption drivers & barriers',
    'Implications for schools',
    'Methodology & verification',
    'Sources & references',
  ],
  sections: [
    {
      heading: 'Executive summary',
      blocks: [
        {
          type: 'lead',
          text: 'Immersive learning is scaling globally with measurable results: large enterprise studies, peer-reviewed research and institution-level reports all point in the same direction \u2014 faster, more confident, better-retained learning.',
        },
        {
          type: 'callout',
          title: 'Key takeaways',
          items: [
            'An enterprise study of 1,600+ managers found VR learners trained up to 4x faster and were 275% more confident applying skills.',
            'A peer-reviewed study reported a 76% increase in learning outcomes from a gamified lab simulation versus traditional teaching.',
            'Institution-level reports include achievement rising from 84% to 94% in VR classes and a +16% course pass rate.',
            'The global AR/VR e-learning services market is projected to grow from $61.6B (2024) to $189.7B (2030).',
          ],
        },
        {
          type: 'stats',
          items: [
            { value: '4x', label: 'Faster training in VR vs classroom (enterprise study, 1,600+ managers)', sourceIds: ['pwc_vr_study'] },
            { value: '275%', label: 'More confident to act on what they learned after VR training', sourceIds: ['pwc_vr_study'] },
            { value: '76%', label: 'Higher learning outcomes vs traditional teaching (peer-reviewed)', sourceIds: ['labster_dtu'] },
            { value: '$189.7B', label: 'Projected AR/VR e-learning services market by 2030', sourceIds: ['gvr_arvr_elearning'] },
          ],
        },
      ],
    },
    {
      heading: 'Market sizing',
      blocks: [
        {
          type: 'paragraph',
          text: 'The global market for AR/VR e-learning services was valued at USD 61.6 billion in 2024 and is projected to reach USD 189.7 billion by 2030, a compound annual growth rate of roughly 20.8%. Estimates vary by analyst and scope, but the direction is consistent: sustained double-digit annual growth, driven by falling hardware costs and government digital-education initiatives.',
          sourceIds: ['gvr_arvr_elearning'],
        },
        {
          type: 'figure',
          figure: {
            title: 'AR/VR e-learning services market, 2024 vs 2030',
            unit: 'USD billion',
            bars: [
              { label: '2024 (actual)', value: 61.6, display: '$61.6B', sourceIds: ['gvr_arvr_elearning'] },
              { label: '2030 (projected)', value: 189.7, display: '$189.7B', sourceIds: ['gvr_arvr_elearning'] },
            ],
            caption: 'Approx. 20.8% CAGR, 2024\u20132030 (Grand View Research).',
          },
        },
        {
          type: 'paragraph',
          text: 'Two structural enablers explain the trajectory. First, affordable standalone headsets and browser-based WebXR have removed the cost and complexity of tethered, high-end hardware. Second, generative AI has dramatically reduced the time and cost of producing immersive content, shifting XR from bespoke projects to scalable, repeatable classroom material.',
        },
      ],
    },
    {
      heading: 'What the research shows',
      blocks: [
        {
          type: 'paragraph',
          text: 'The evidence base spans enterprise training, peer-reviewed education research, and institution-level reporting. The magnitudes differ by context, but the consistency of positive effects is the headline finding.',
        },
        {
          type: 'figure',
          figure: {
            title: 'Reported effect sizes across studies',
            unit: 'as reported',
            bars: [
              { label: 'Confidence uplift after VR training (%)', value: 275, display: '275%', sourceIds: ['pwc_vr_study'] },
              { label: 'Learning-outcome gain vs traditional (%)', value: 76, display: '76%', sourceIds: ['labster_dtu'] },
              { label: 'Course pass-rate increase (%)', value: 16, display: '+16%', sourceIds: ['labster_evidence'] },
              { label: 'Achievement uplift, traditional\u2192VR (pts)', value: 10, display: '+10 pts', sourceIds: ['victoryxr_morehouse'] },
            ],
            caption: 'Effect sizes are reproduced as reported by each source and are not directly comparable across study designs.',
          },
        },
        {
          type: 'bullets',
          items: [
            { text: 'Enterprise VR learners trained up to 4x faster and were 275% more confident applying what they learned (study of 1,600+ managers).', sourceIds: ['pwc_vr_study'] },
            { text: 'A peer-reviewed study reported a 76% increase in learning outcomes using a gamified laboratory simulation versus traditional teaching, with further gains when used at home before in-person labs.', sourceIds: ['labster_dtu'] },
            { text: 'A virtual science-lab platform reports course pass rates rising by 16% after introduction at a European university.', sourceIds: ['labster_evidence'] },
            { text: 'A US college VR-campus ("metaversity") deployment reported student achievement of 94% in VR classes versus 84% face-to-face/online.', sourceIds: ['victoryxr_morehouse', 'victoryxr_highered'] },
          ],
        },
      ],
    },
    {
      heading: 'Documented outcomes by region',
      blocks: [
        {
          type: 'subheading',
          text: 'Americas',
        },
        {
          type: 'table',
          table: {
            columns: ['Deployment', 'Scale', 'Reported outcome'],
            widths: [1.4, 1, 1.6],
            rows: [
              {
                cells: [
                  'Large urban school district (classroom XR platform)',
                  '16,000+ headsets',
                  'Deployed to support an instructional-technology initiative and boost engagement',
                ],
                sourceIds: ['classvr_lausd'],
              },
              {
                cells: [
                  'AR/VR STEM platform across districts & colleges',
                  '3,500+ districts/institutions',
                  'Used for STEM and career-technical education',
                ],
                sourceIds: ['zspace_talladega', 'zspace_danbury'],
              },
              {
                cells: [
                  'US college VR campus ("metaversity")',
                  'Course-level',
                  'Achievement 84% \u2192 94%; attendance up to 90%',
                ],
                sourceIds: ['victoryxr_morehouse'],
              },
            ],
          },
        },
        {
          type: 'subheading',
          text: 'Europe',
        },
        {
          type: 'table',
          table: {
            columns: ['Deployment', 'Reported outcome'],
            widths: [1.3, 1.7],
            rows: [
              {
                cells: [
                  'Virtual science labs at a European university',
                  'Course pass rates increased by 16%',
                ],
                sourceIds: ['labster_evidence'],
              },
              {
                cells: [
                  'Peer-reviewed gamified lab simulation',
                  '+76% learning outcomes vs traditional; +101% when used at home',
                ],
                sourceIds: ['labster_dtu'],
              },
              {
                cells: [
                  'Leading classroom XR platform (global ecosystem)',
                  '2M+ students across 250,000 classrooms in 90+ countries',
                ],
                sourceIds: ['classvr_iste25', 'avantis_growth'],
              },
            ],
          },
        },
        {
          type: 'subheading',
          text: 'Asia-Pacific',
        },
        {
          type: 'table',
          table: {
            columns: ['Deployment', 'Reported outcome'],
            widths: [1.3, 1.7],
            rows: [
              {
                cells: [
                  'Provincial education metaverse platform (South Korea)',
                  '396 schools (~30% of the province\u2019s elementary schools) using the platform',
                ],
                sourceIds: ['korea_gyeonggi'],
              },
              {
                cells: [
                  'National metaverse strategy (South Korea)',
                  'State target to become a top-5 global metaverse market by 2026',
                ],
                sourceIds: ['korea_herald_metaverse'],
              },
            ],
            note: 'Vendor and product names are generalised in the body; original publishers appear in the Sources page.',
          },
        },
      ],
    },
    {
      heading: 'Adoption drivers & barriers',
      blocks: [
        {
          type: 'subheading',
          text: 'Drivers',
        },
        {
          type: 'bullets',
          items: [
            'Falling hardware costs: affordable standalone headsets and WebXR remove access barriers.',
            'Generative AI authoring: immersive content can be produced in minutes, not weeks.',
            'Policy momentum: national digital-education and skilling initiatives create demand.',
            'Evidence: a growing, consistent body of measured outcomes de-risks procurement.',
          ],
        },
        {
          type: 'subheading',
          text: 'Barriers',
        },
        {
          type: 'bullets',
          items: [
            'Teacher training and change management remain the largest practical hurdles.',
            'Content must be curriculum-aligned and assessable, not just novel.',
            'Total cost of ownership (devices, hygiene, management) needs realistic budgeting.',
            'Equity: deployments must reach under-resourced schools, not only flagship ones.',
          ],
        },
      ],
    },
    {
      heading: 'Implications for schools',
      blocks: [
        {
          type: 'paragraph',
          text: 'The practical lesson from global deployments is that impact follows curriculum alignment and teacher enablement, not hardware alone. The strongest results come from programmes that pair immersive content with assessment and give teachers fast, low-effort ways to create and adapt lessons.',
        },
        {
          type: 'callout',
          title: 'What good looks like',
          items: [
            'Curriculum-aligned XR lessons with built-in, scenario-based assessment.',
            'AI authoring so teachers can build and adapt content quickly.',
            'Web-based delivery on affordable hardware to maximise reach and equity.',
            'Outcome tracking to demonstrate measurable learning gains over time.',
          ],
        },
      ],
    },
    {
      heading: 'Methodology & verification',
      blocks: [
        {
          type: 'paragraph',
          text: 'This report follows a verified-only standard. Every quantitative claim is reproduced as reported by a credible, publicly accessible source listed, with its URL, on the Sources page. Effect sizes from different studies are presented as published and are not directly comparable, because study designs, populations and measures differ.',
        },
        {
          type: 'paragraph',
          text: 'Commercial platforms are described generically in the body to keep the analysis vendor-neutral; the Sources page retains the original publisher names and links so each figure can be independently verified. Claims that could not be verified at the time of writing were intentionally excluded.',
        },
      ],
    },
  ],
  sourceIds: [
    'gvr_arvr_elearning',
    'pwc_vr_study',
    'classvr_iste25',
    'classvr_lausd',
    'avantis_growth',
    'zspace_talladega',
    'zspace_danbury',
    'victoryxr_morehouse',
    'victoryxr_highered',
    'labster_evidence',
    'labster_dtu',
    'korea_gyeonggi',
    'korea_herald_metaverse',
  ],
};

/* ------------------------------------------------------------------ */
/* FUTURE REPORT (content unchanged in scope; restructured to blocks)  */
/* ------------------------------------------------------------------ */

export const FUTURE_REPORT: ReportDefinition = {
  id: 'future',
  fileName: 'LearnXR-Future-of-XR-Education-Report.pdf',
  kicker: 'LearnXR Perspective',
  title: 'The Future of XR in Education',
  subtitle:
    'Where immersive, AI-assisted learning is heading \u2014 and how schools can prepare today.',
  intro:
    'The next decade of education will be shaped by the convergence of immersive media and generative AI. This forward-looking report synthesises documented market signals with LearnXR\u2019s framework for preparing learners for an immersive, technology-driven economy.',
  toc: [
    'The convergence of XR and AI',
    'Signals from the market',
    'The LearnXR Impact Framework',
    'Traditional vs immersive learning',
    'Sources & references',
  ],
  sections: [
    {
      heading: 'The convergence of XR and AI',
      blocks: [
        {
          type: 'paragraph',
          text: 'Generative AI is collapsing the cost and time of creating immersive content, while affordable standalone headsets and WebXR are removing access barriers. Together they make classroom-scale XR practical for the first time.',
        },
        {
          type: 'paragraph',
          text: 'The result is a shift from one-size-fits-all instruction toward adaptive, experiential learning that meets each student where they are.',
        },
      ],
    },
    {
      heading: 'Signals from the market',
      blocks: [
        {
          type: 'stats',
          items: [
            { value: '$61.6B', label: 'AR/VR e-learning services market in 2024', sourceIds: ['gvr_arvr_elearning'] },
            { value: '$189.7B', label: 'Projected market size by 2030 (~20.8% CAGR)', sourceIds: ['gvr_arvr_elearning'] },
            { value: '4x', label: 'Faster training in VR vs classroom (enterprise study)', sourceIds: ['pwc_vr_study'] },
          ],
        },
        {
          type: 'figure',
          figure: {
            title: 'Market trajectory',
            unit: 'USD billion',
            bars: [
              { label: '2024', value: 61.6, display: '$61.6B', sourceIds: ['gvr_arvr_elearning'] },
              { label: '2030 (projected)', value: 189.7, display: '$189.7B', sourceIds: ['gvr_arvr_elearning'] },
            ],
            caption: 'Approx. 20.8% CAGR, 2024\u20132030 (Grand View Research).',
          },
        },
      ],
    },
    {
      heading: 'The LearnXR Impact Framework',
      blocks: [
        {
          type: 'paragraph',
          text: 'Six pillars translate immersive technology into durable learning outcomes.',
        },
        {
          type: 'bullets',
          items: [
            'AI-Assisted Learning: build immersive lessons, assessments and 3D assets in minutes.',
            'Self-Paced Learning: on-demand XR lessons that adapt to individual progress.',
            'Classroom XR Learning: shared immersive experiences for hands-on activities.',
            'Virtual Tours: 360\u00b0 immersive tours that take students anywhere.',
            'Interactive Assessments: auto-graded, scenario-based assessments of applied understanding.',
            'Future Workforce Readiness: early exposure to XR, AI and digital tools.',
          ],
        },
      ],
    },
    {
      heading: 'Traditional vs immersive learning',
      blocks: [
        {
          type: 'table',
          table: {
            columns: ['Dimension', 'Traditional', 'Immersive / LearnXR'],
            rows: [
              { cells: ['Engagement', 'Passive listening and reading', 'Active, immersive participation'] },
              { cells: ['Retention', 'Forgetting curve after lectures', 'Experiential memory anchors recall'] },
              { cells: ['Practical training', 'Limited by labs, cost and safety', 'Unlimited risk-free virtual practice'] },
              { cells: ['Accessibility', 'Field trips constrained by geography', 'Any place or era via virtual tours'] },
              { cells: ['Personalisation', 'One pace for the whole class', 'AI-adapted, self-paced pathways'] },
            ],
          },
        },
      ],
    },
  ],
  sourceIds: ['gvr_arvr_elearning', 'pwc_vr_study', 'classvr_iste25', 'victoryxr_morehouse'],
};

export const REPORTS = {
  india: INDIA_REPORT,
  global: GLOBAL_REPORT,
  future: FUTURE_REPORT,
} as const;
