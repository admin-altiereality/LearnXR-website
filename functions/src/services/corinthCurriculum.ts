export interface CorinthCurriculumInput {
  category: string;
  title: string;
  description: string;
}

export interface CorinthCurriculumClassification {
  subject: 'Biology' | 'Physics' | 'Chemistry';
  gradeBands: string[];
  curriculumTags: string[];
}

interface CurriculumRule {
  pattern: RegExp;
  gradeBands: string[];
  tag: string;
}

const BIOLOGY_DEFAULT = ['6', '7', '8', '9', '11'];
const HUMAN_ANATOMY_GRADES = ['7', '8', '9', '10', '11'];
const SENIOR_BIOLOGY_GRADES = ['8', '9', '10', '11', '12'];
const PHYSICS_DEFAULT = ['8', '9', '10', '11', '12'];
const CHEMISTRY_DEFAULT = ['8', '9', '10', '11', '12'];

const RULES: Record<string, CurriculumRule[]> = {
  'Human Biology': [
    { pattern: /cell|virus|synapse|nephron|villus|fetus|embryo|receptor/i, gradeBands: SENIOR_BIOLOGY_GRADES, tag: 'cell-and-human-physiology' },
    { pattern: /heart|vein|arter|kidney|stomach|pancreas|tooth|bone|muscle|eye|respiratory|urinary|anatomy|section/i, gradeBands: HUMAN_ANATOMY_GRADES, tag: 'human-anatomy' },
  ],
  'Animal Biology': [
    { pattern: /life cycle|egg|larva|embryo|reproduction/i, gradeBands: ['6', '7', '8', '10', '11'], tag: 'animal-life-cycles' },
    { pattern: /anatomy|organ|section|wall/i, gradeBands: BIOLOGY_DEFAULT, tag: 'animal-anatomy' },
  ],
  'Plant Biology': [
    { pattern: /cone|flower|fruit|seed|spore|protonema|reproduct/i, gradeBands: BIOLOGY_DEFAULT, tag: 'plant-reproduction' },
    { pattern: /trunk|stem|root|leaf|section/i, gradeBands: BIOLOGY_DEFAULT, tag: 'plant-structure' },
  ],
  Physics: [
    { pattern: /jack|lever|friction|dynamometer|force|pressure|speed|machine/i, gradeBands: ['7', '8', '9', '11'], tag: 'force-and-machines' },
    { pattern: /turbine|generating|energy|water wheel|battery/i, gradeBands: ['6', '7', '8', '9', '10', '11'], tag: 'energy-and-electricity' },
    { pattern: /sound|ear|loudspeaker|wave/i, gradeBands: ['8', '9', '10', '11', '12'], tag: 'waves-and-sound' },
    { pattern: /fiber optic|optical|light|lens|mirror/i, gradeBands: ['8', '9', '10', '11', '12'], tag: 'light-and-optics' },
    { pattern: /rutherford|crystal|lattice|atom|kilogram|prototype/i, gradeBands: ['9', '10', '11', '12'], tag: 'modern-physics-and-measurement' },
  ],
  Chemistry: [
    { pattern: /orbital|hybrid|ionic bond|covalent|anion|cation|electron|meso/i, gradeBands: ['9', '10', '11', '12'], tag: 'chemical-bonding' },
    { pattern: /rna|dna|adenosine|vitamin|protein|amino|biomolecule/i, gradeBands: ['10', '11', '12'], tag: 'biomolecules' },
    { pattern: /phase|freez|evapor|sublim|particle|dissolv|solution/i, gradeBands: ['6', '7', '8', '9', '11'], tag: 'states-of-matter-and-solutions' },
    { pattern: /iron|calcium|silver|titanium|element|periodic/i, gradeBands: CHEMISTRY_DEFAULT, tag: 'elements-and-periodicity' },
  ],
};

function categoryDefaults(category: string): CorinthCurriculumClassification {
  if (category === 'Physics') {
    return { subject: 'Physics', gradeBands: PHYSICS_DEFAULT, curriculumTags: ['physics'] };
  }
  if (category === 'Chemistry') {
    return { subject: 'Chemistry', gradeBands: CHEMISTRY_DEFAULT, curriculumTags: ['chemistry'] };
  }
  return {
    subject: 'Biology',
    gradeBands: BIOLOGY_DEFAULT,
    curriculumTags: [category.toLowerCase().replace(/\s+/g, '-')],
  };
}

export function classifyCorinthCurriculum(input: CorinthCurriculumInput): CorinthCurriculumClassification {
  const defaults = categoryDefaults(input.category);
  const searchableText = `${input.title} ${input.description}`;
  const matchingRule = (RULES[input.category] || []).find((rule) => rule.pattern.test(searchableText));

  return {
    subject: defaults.subject,
    gradeBands: matchingRule ? [...matchingRule.gradeBands] : [...defaults.gradeBands],
    curriculumTags: [...new Set([...defaults.curriculumTags, matchingRule?.tag].filter((tag): tag is string => Boolean(tag)))],
  };
}
