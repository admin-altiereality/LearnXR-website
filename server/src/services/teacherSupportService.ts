/**
 * AI-Enabled Teacher Support Service
 * Implements patterns from microsoft/ai-edu: structured lesson planning (prior knowledge,
 * misconceptions, SMART objectives), content suggestions, and standards-aligned rubrics.
 * Uses existing OPENAI_API_KEY.
 */

import OpenAI from 'openai';

export interface LessonPlanRequest {
  subject: string;
  classLevel: string;
  curriculum?: string;
  topic: string;
  durationMinutes?: number;
}

export interface LessonPlanResponse {
  title: string;
  objectives: string[];
  materials: string[];
  steps: Array<{ step: number; description: string; duration?: string }>;
  assessmentIdeas: string[];
  differentiationTips: string[];
  /** Prior knowledge students should have (microsoft/ai-edu style) */
  priorKnowledge?: string[];
  /** Common misconceptions to address */
  commonMisconceptions?: string[];
}

export interface ContentSuggestionRequest {
  subject: string;
  classLevel: string;
  topic: string;
  type: 'examples' | 'activities' | 'discussion_questions' | 'real_world_connections';
}

export interface RubricRequest {
  subject: string;
  classLevel: string;
  assignmentType: string;
  criteriaCount?: number;
}

export interface RubricResponse {
  criteria: Array<{ name: string; levels: Array<{ level: string; description: string }> }>;
  maxScore: number;
}

class TeacherSupportService {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('✅ Teacher Support Service initialized (using existing OPENAI_API_KEY)');
    } else {
      console.warn('⚠️ OPENAI_API_KEY not found. Teacher support will return fallback content.');
    }
  }

  isConfigured(): boolean {
    return this.openai !== null;
  }

  /**
   * Generate a lesson plan using AI
   */
  async generateLessonPlan(req: LessonPlanRequest): Promise<LessonPlanResponse> {
    if (!this.openai) return this.fallbackLessonPlan(req);

    try {
      const systemPrompt = `You are an expert K-12 curriculum designer (microsoft/ai-edu style). Generate a structured lesson plan. Output valid JSON only:
{
  "title": "string",
  "objectives": ["string - use SMART: Specific, Measurable, Achievable, Relevant, Time-bound"],
  "materials": ["string"],
  "steps": [{"step": 1, "description": "string", "duration": "e.g. 5 min"}],
  "assessmentIdeas": ["string"],
  "differentiationTips": ["string"],
  "priorKnowledge": ["string - what students should already know"],
  "commonMisconceptions": ["string - misconceptions to address explicitly"]
}
Use 3-5 SMART objectives, 4-8 steps, 2-4 assessment ideas, 2-3 differentiation tips, 2-4 prior knowledge items, 2-3 common misconceptions.`;

      const userPrompt = `Create a lesson plan for:
- Subject: ${req.subject}
- Class: ${req.classLevel}
- Curriculum: ${req.curriculum || 'General'}
- Topic: ${req.topic}
- Duration: ${req.durationMinutes || 45} minutes`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 1200,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response');
      const parsed = JSON.parse(content);
      return {
        title: parsed.title || req.topic,
        objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
        materials: Array.isArray(parsed.materials) ? parsed.materials : [],
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        assessmentIdeas: Array.isArray(parsed.assessmentIdeas) ? parsed.assessmentIdeas : [],
        differentiationTips: Array.isArray(parsed.differentiationTips) ? parsed.differentiationTips : [],
        priorKnowledge: Array.isArray(parsed.priorKnowledge) ? parsed.priorKnowledge : [],
        commonMisconceptions: Array.isArray(parsed.commonMisconceptions) ? parsed.commonMisconceptions : [],
      };
    } catch (error) {
      console.error('Lesson plan generation error:', error);
      return this.fallbackLessonPlan(req);
    }
  }

  private fallbackLessonPlan(req: LessonPlanRequest): LessonPlanResponse {
    return {
      title: `Lesson: ${req.topic}`,
      objectives: ['Understand key concepts', 'Apply learning through practice'],
      materials: ['Textbook', 'Whiteboard', 'Handouts'],
      steps: [
        { step: 1, description: 'Introduction and hook', duration: '5 min' },
        { step: 2, description: 'Direct instruction', duration: '15 min' },
        { step: 3, description: 'Guided practice', duration: '15 min' },
        { step: 4, description: 'Independent practice', duration: '10 min' },
      ],
      assessmentIdeas: ['Exit ticket', 'Quick quiz'],
      differentiationTips: ['Provide visual aids', 'Use peer support'],
      priorKnowledge: ['Relevant prior concepts'],
      commonMisconceptions: ['Address common confusions'],
    };
  }

  /**
   * Get content suggestions (examples, activities, discussion questions, etc.)
   */
  async getContentSuggestions(req: ContentSuggestionRequest): Promise<{ items: string[] }> {
    if (!this.openai) {
      return {
        items: ['Use textbook examples', 'Try a think-pair-share activity', 'Connect to real-world applications'],
      };
    }

    try {
      const typeLabels: Record<string, string> = {
        examples: 'concrete examples or sample problems',
        activities: 'hands-on or in-class activities',
        discussion_questions: 'discussion questions for the class',
        real_world_connections: 'real-world connections or applications',
      };
      const label = typeLabels[req.type] || req.type;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a K-12 teaching assistant. Respond with a JSON object: { "items": ["string", ...] }. Provide 4-6 short, actionable items. No markdown.',
          },
          {
            role: 'user',
            content: `Subject: ${req.subject}, Class: ${req.classLevel}, Topic: ${req.topic}. Suggest ${label} for this topic. Output only JSON.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response');
      const parsed = JSON.parse(content) as { items?: string[] };
      return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch (error) {
      console.error('Content suggestions error:', error);
      return { items: ['Review textbook', 'Use group discussion', 'Add a short quiz'] };
    }
  }

  /**
   * Generate a grading rubric
   */
  async generateRubric(req: RubricRequest): Promise<RubricResponse> {
    if (!this.openai) return this.fallbackRubric(req);

    try {
      const criteriaCount = Math.min(5, Math.max(3, req.criteriaCount || 4));
      const systemPrompt = `You are an expert in educational assessment (microsoft/ai-edu / standards-aligned rubrics). Generate a grading rubric as JSON:
{
  "criteria": [
    { "name": "Criterion name", "levels": [
      {"level": "Exceeds", "description": "..."},
      {"level": "Meets", "description": "..."},
      {"level": "Approaching", "description": "..."},
      {"level": "Beginning", "description": "..."}
    ] }
  ],
  "maxScore": number
}
Use ${criteriaCount} criteria. Each criterion should have 4 levels: Exceeds, Meets, Approaching, Beginning (or 3 levels if simpler: Exceeds, Meets, Beginning). maxScore can be 100 or based on points. Output only valid JSON.`;

      const userPrompt = `Create a rubric for:
- Subject: ${req.subject}
- Class: ${req.classLevel}
- Assignment type: ${req.assignmentType}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response');
      const parsed = JSON.parse(content) as RubricResponse;
      return {
        criteria: Array.isArray(parsed.criteria) ? parsed.criteria : this.fallbackRubric(req).criteria,
        maxScore: typeof parsed.maxScore === 'number' ? parsed.maxScore : 100,
      };
    } catch (error) {
      console.error('Rubric generation error:', error);
      return this.fallbackRubric(req);
    }
  }

  private fallbackRubric(req: RubricRequest): RubricResponse {
    return {
      criteria: [
        {
          name: 'Understanding',
          levels: [
            { level: 'Excellent', description: 'Shows full understanding' },
            { level: 'Good', description: 'Shows good understanding with minor gaps' },
            { level: 'Needs Improvement', description: 'Shows limited understanding' },
          ],
        },
        {
          name: 'Accuracy',
          levels: [
            { level: 'Excellent', description: 'All work is accurate' },
            { level: 'Good', description: 'Mostly accurate with small errors' },
            { level: 'Needs Improvement', description: 'Multiple errors' },
          ],
        },
      ],
      maxScore: 100,
    };
  }
}

export default new TeacherSupportService();
