import OpenAI from 'openai';

// Constants for validation
const CURRICULUMS = ['NCERT', 'CBSE', 'ICSE', 'State Board', 'RBSE'];
const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Hindi',
  'Social Studies',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography',
  'Computer Science'
];

// Subject name mappings (for variations like "Social Science" -> "Social Studies")
const SUBJECT_MAPPINGS: Record<string, string> = {
  'Social Science': 'Social Studies',
  'Social Studies': 'Social Studies',
  'Math': 'Mathematics',
  'Maths': 'Mathematics'
};

interface AssistantConfig {
  name?: string;
  instructions?: string;
  model?: string;
  curriculum?: string;
  class?: string;
  subject?: string;
}

class OpenAIAssistantService {
  private openai: OpenAI;
  private assistantId: string | null = null;

  constructor(useAvatarKey: boolean = false) {
    // Use separate API key for avatar assistant if specified
    let apiKey: string | undefined;
    
    if (useAvatarKey) {
      apiKey = process.env.OPENAI_AVATAR_API_KEY || process.env.OPENAI_API_KEY;
      if (process.env.OPENAI_AVATAR_API_KEY) {
        console.log('✅ Using OPENAI_AVATAR_API_KEY for avatar assistant');
      } else {
        console.warn('⚠️ OPENAI_AVATAR_API_KEY not found, falling back to OPENAI_API_KEY');
      }
    } else {
      apiKey = process.env.OPENAI_API_KEY;
    }
    
    if (!apiKey) {
      throw new Error(useAvatarKey 
        ? 'OPENAI_AVATAR_API_KEY (or OPENAI_API_KEY) is not configured'
        : 'OPENAI_API_KEY is not configured');
    }
    
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Create or retrieve an assistant for educational content
   */
  async getOrCreateAssistant(config?: AssistantConfig): Promise<string> {
    if (this.assistantId) {
      return this.assistantId;
    }

    const assistant = await this.openai.beta.assistants.create({
      name: config?.name || 'LearnXR Teacher',
      instructions: config?.instructions || `You are a friendly, patient, and engaging K12 teacher for LearnXR, 
        an immersive VR learning platform. Your role is to:
        - Explain NCERT curriculum concepts in simple, age-appropriate language
        - Use analogies and examples that students can relate to
        - Encourage questions and interactive learning
        - Adapt explanations based on student understanding
        - Keep responses concise (2-3 sentences) for VR interactions
        - Use a warm, encouraging tone
        
        When answering:
        - Break down complex topics into digestible parts
        - Use visual descriptions that work well in VR environments
        - Ask follow-up questions to check understanding
        - Provide real-world examples when possible`,
      model: config?.model || 'gpt-4o-mini',
      tools: [
        {
          type: 'code_interpreter'
        }
      ]
    });

    this.assistantId = assistant.id;
    return assistant.id;
  }

  /**
   * Create a thread for a conversation
   */
  async createThread(): Promise<string> {
    const thread = await this.openai.beta.threads.create();
    return thread.id;
  }

  /**
   * Send a message and get response
   */
  async sendMessage(threadId: string, message: string): Promise<string> {
    // Add user message
    await this.openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    });

    // Get assistant ID
    const assistantId = await this.getOrCreateAssistant();

    // Run the assistant
    const run = await this.openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId
    });

    // Wait for completion
    let runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
    
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    if (runStatus.status === 'completed') {
      // Retrieve messages
      const messages = await this.openai.beta.threads.messages.list(threadId);
      const assistantMessage = messages.data.find(
        (msg: any) => msg.role === 'assistant' && (msg as any).run_id === run.id
      );
      
      if (assistantMessage && (assistantMessage as any).content?.[0]?.type === 'text') {
        return (assistantMessage as any).content[0].text.value;
      }
    }

    throw new Error(`Assistant run failed: ${runStatus.status}`);
  }

  /**
   * Normalize class number (ensure it's a valid string)
   */
  private normalizeClass(classStr: string): string | null {
    const trimmed = classStr.trim();
    const num = parseInt(trimmed, 10);
    
    if (isNaN(num) || num < 1 || num > 12) {
      return null;
    }
    
    return String(num);
  }

  /**
   * Normalize subject name
   */
  private normalizeSubject(subject: string): string | null {
    const trimmed = subject.trim();
    
    // Direct match
    if (SUBJECTS.includes(trimmed)) {
      return trimmed;
    }
    
    // Check mappings
    if (SUBJECT_MAPPINGS[trimmed]) {
      return SUBJECT_MAPPINGS[trimmed];
    }
    
    // Case-insensitive match
    const lowerTrimmed = trimmed.toLowerCase();
    for (const subj of SUBJECTS) {
      if (subj.toLowerCase() === lowerTrimmed) {
        return subj;
      }
    }
    
    return null;
  }

  /**
   * Parse RBSE assistant names
   * Patterns:
   * - "Class {number} {Subject} RBSE"
   * - "Class {number}th {Subject} RBSE"
   */
  private parseRBSEAssistant(name: string): { curriculum: string; class: string; subject: string } | null {
    // Pattern 1: "Class {number} {Subject} RBSE" - Most common format
    // Example: "Class 10 Hindi RBSE" or "Class 9 Mathematics RBSE"
    const classPattern1 = /^CLASS\s+(\d+)\s+(.+?)\s+RBSE$/i;
    const match1 = name.match(classPattern1);
    if (match1) {
      const classNum = this.normalizeClass(match1[1]);
      const subjectStr = match1[2].trim();
      const subject = this.normalizeSubject(subjectStr);
      
      console.log(`🔍 RBSE Pattern 1 match for "${name}": class=${classNum}, subjectStr="${subjectStr}", normalizedSubject=${subject}`);
      
      if (classNum && subject) {
        return { curriculum: 'RBSE', class: classNum, subject };
      } else {
        console.warn(`⚠️ RBSE Pattern 1 matched but normalization failed: classNum=${classNum}, subject=${subject}`);
      }
    }
    
    // Pattern 2: "Class {number}th {Subject} RBSE" (with ordinal suffix)
    const classPattern2 = /^CLASS\s+(\d+)(?:TH|ST|ND|RD)?\s+(.+?)\s+RBSE$/i;
    const match2 = name.match(classPattern2);
    if (match2 && !match1) { // Only if pattern 1 didn't match
      const classNum = this.normalizeClass(match2[1]);
      const subjectStr = match2[2].trim();
      const subject = this.normalizeSubject(subjectStr);
      
      console.log(`🔍 RBSE Pattern 2 match for "${name}": class=${classNum}, subjectStr="${subjectStr}", normalizedSubject=${subject}`);
      
      if (classNum && subject) {
        return { curriculum: 'RBSE', class: classNum, subject };
      }
    }
    
    console.warn(`⚠️ RBSE assistant "${name}" did not match any pattern`);
    return null;
  }

  /**
   * List all available assistants and extract their configurations
   * Returns an array of assistant configurations (curriculum, class, subject)
   */
  async listAvailableAssistants(): Promise<Array<{ curriculum: string; class: string; subject: string }>> {
    try {
      console.log('📋 Fetching available assistants from OpenAI...');
      console.log('🔑 API Key configured:', !!this.openai);
      
      if (!this.openai) {
        throw new Error('OpenAI client is not initialized');
      }
      
      const assistants = await this.openai.beta.assistants.list({ limit: 100 });
      console.log('📦 OpenAI API response received, assistants count:', assistants.data?.length || 0);
      
      const availableConfigs: Array<{ curriculum: string; class: string; subject: string }> = [];
      
      // Parse assistant names to extract curriculum/class/subject
      for (const assistant of assistants.data) {
        if (!assistant.name) continue;
        
        const name = assistant.name.trim();
        console.log(`🔍 Parsing assistant: "${name}"`);
        
        // Try RBSE patterns FIRST (don't require "Teacher" suffix)
        // RBSE assistants use format: "Class {number} {Subject} RBSE"
        if (name.toUpperCase().includes('RBSE')) {
          console.log(`   → Detected RBSE assistant, attempting to parse...`);
          const rbseConfig = this.parseRBSEAssistant(name);
          if (rbseConfig) {
            console.log(`   ✅ Successfully parsed RBSE:`, rbseConfig);
            // Check if not already added
            const exists = availableConfigs.some(
              c => c.curriculum === rbseConfig.curriculum &&
                   c.class === rbseConfig.class &&
                   c.subject === rbseConfig.subject
            );
            if (!exists) {
              availableConfigs.push(rbseConfig);
              console.log(`   ✅ Added RBSE config to list`);
            } else {
              console.log(`   ⚠️ RBSE config already exists, skipping`);
            }
          } else {
            console.log(`   ❌ Failed to parse RBSE assistant: "${name}"`);
          }
          continue; // Skip standard format parsing for RBSE
        }
        
        // Try standard format: "{curriculum} {class} {subject} Teacher"
        if (name.endsWith(' Teacher')) {
          const nameWithoutSuffix = name.replace(' Teacher', '').trim();
          
          // Try to match each curriculum first
          for (const curriculum of CURRICULUMS) {
            if (curriculum === 'RBSE') continue; // Handle RBSE separately (already done above)
            
            if (nameWithoutSuffix.startsWith(curriculum + ' ')) {
              const afterCurriculum = nameWithoutSuffix.substring(curriculum.length + 1).trim();
              
              // Try to match each class
              for (const classLevel of CLASSES) {
                if (afterCurriculum.startsWith(classLevel + ' ')) {
                  const subject = afterCurriculum.substring(classLevel.length + 1).trim();
                  
                  if (this.normalizeSubject(subject)) {
                    const normalizedSubject = this.normalizeSubject(subject)!;
                    availableConfigs.push({
                      curriculum,
                      class: classLevel,
                      subject: normalizedSubject
                    });
                    break;
                  }
                }
              }
              break;
            }
          }
        }
      }
      
      console.log(`✅ Found ${availableConfigs.length} available assistant configurations`);
      if (availableConfigs.length > 0) {
        console.log('📋 Available configurations:', availableConfigs);
      }
      return availableConfigs;
    } catch (error: any) {
      console.error('❌ Error listing assistants:', error);
      console.error('   Error message:', error.message);
      console.error('   Error status:', error.status);
      console.error('   Error code:', error.code);
      console.error('   Error type:', error.type);
      console.error('   Error stack:', error.stack);
      
      // Re-throw the error so the route can handle it properly
      throw error;
    }
  }
}

export default OpenAIAssistantService;
