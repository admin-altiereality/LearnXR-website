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
  private assistants: Map<string, string> = new Map(); // Cache assistants by key

  constructor(useAvatarKey: boolean = false) {
    // Use separate API key for avatar assistant if specified
    let apiKey: string | undefined;
    
    if (useAvatarKey) {
      apiKey = process.env.OPENAI_AVATAR_API_KEY || process.env.OPENAI_API_KEY;
      if (process.env.OPENAI_AVATAR_API_KEY) {
        const keyPreview = process.env.OPENAI_AVATAR_API_KEY.substring(0, 20) + '...' + process.env.OPENAI_AVATAR_API_KEY.substring(process.env.OPENAI_AVATAR_API_KEY.length - 4);
        console.log('✅ Using OPENAI_AVATAR_API_KEY for avatar assistant');
        console.log('🔑 API Key preview:', keyPreview, `(length: ${process.env.OPENAI_AVATAR_API_KEY.length})`);
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
    
    const keyPreview = apiKey.substring(0, 20) + '...' + apiKey.substring(apiKey.length - 4);
    console.log('🔑 Final API key being used:', keyPreview, `(length: ${apiKey.length})`);
    
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate assistant key from curriculum/class/subject
   */
  private getAssistantKey(curriculum?: string, classLevel?: string, subject?: string): string {
    return `${curriculum || 'default'}_${classLevel || 'default'}_${subject || 'default'}`;
  }

  /**
   * Generate instructions based on curriculum/class/subject
   */
  private generateInstructions(config?: AssistantConfig): string {
    const { curriculum, class: classLevel, subject } = config || {};
    
    // If we have curriculum/class/subject, generate personalized instructions
    if (curriculum && classLevel && subject) {
      return `You are a friendly, patient, and engaging K12 teacher for LearnXR, an immersive VR learning platform.

YOUR ROLE:
- You teach ${subject} to Class ${classLevel} students following ${curriculum} curriculum
- Explain concepts in simple, age-appropriate language
- Use analogies and examples that students can relate to
- Encourage questions and interactive learning
- Keep responses concise (2-3 sentences) for VR interactions
- Use a warm, encouraging tone

GREETING BEHAVIOR:
- When a student first says "Hello" or greets you, respond with: "Hi student, you want to learn Class ${classLevel} ${subject}. Which chapter you want to learn?"
- This greeting acknowledges that you already know their class and subject
- After the greeting, answer their questions directly

WHEN ANSWERING:
- Break down complex topics into digestible parts
- Use visual descriptions that work well in VR environments
- Ask follow-up questions to check understanding (BUT NEVER about curriculum/class/subject)
- Provide real-world examples when possible

FINAL REMINDER: You are PERMANENTLY configured for ${curriculum} Curriculum, Class ${classLevel}, Subject: ${subject}. 
Answer ALL questions based on this context. NEVER ask the student about subject, class, or curriculum.`;
    }
    
    // Fallback instructions if no config provided
    return `You are a friendly, patient, and engaging K12 teacher for LearnXR, 
an immersive VR learning platform. Your role is to:
- Explain curriculum concepts in simple, age-appropriate language
- Use analogies and examples that students can relate to
- Encourage questions and interactive learning
- Adapt explanations based on student understanding
- Keep responses concise (2-3 sentences) for VR interactions
- Use a warm, encouraging tone

When answering:
- Break down complex topics into digestible parts
- Use visual descriptions that work well in VR environments
- Ask follow-up questions to check understanding
- Provide real-world examples when possible`;
  }

  /**
   * Create or retrieve an assistant for educational content
   */
  async getOrCreateAssistant(config?: AssistantConfig): Promise<string> {
    const assistantKey = this.getAssistantKey(config?.curriculum, config?.class, config?.subject);
    
    // Check cache first
    if (this.assistants.has(assistantKey)) {
      const cachedId = this.assistants.get(assistantKey)!;
      console.log(`✅ Using cached assistant for ${assistantKey}: ${cachedId}`);
      return cachedId;
    }

    // Try to find existing assistant by name pattern
    if (config?.curriculum && config?.class && config?.subject) {
      try {
        // Try standard format: "{Curriculum} {Class} {Subject} Teacher"
        const standardName = `${config.curriculum} ${config.class} ${config.subject} Teacher`;
        
        // Try RBSE format: "Class {Class} {Subject} RBSE"
        const rbseName = config.curriculum === 'RBSE' 
          ? `Class ${config.class} ${config.subject} RBSE`
          : null;
        
        const assistants = await this.openai.beta.assistants.list({ limit: 100 });
        
        // Look for matching assistant
        const matchingAssistant = assistants.data.find(assistant => {
          const name = assistant.name || '';
          return name === standardName || name === rbseName;
        });
        
        if (matchingAssistant) {
          console.log(`✅ Found existing assistant: ${matchingAssistant.name} (${matchingAssistant.id})`);
          this.assistants.set(assistantKey, matchingAssistant.id);
          
          // Update instructions to ensure they're current
          try {
            const instructions = this.generateInstructions(config);
            await this.openai.beta.assistants.update(matchingAssistant.id, {
              instructions: instructions
            });
            console.log(`✅ Updated assistant instructions`);
          } catch (updateError: any) {
            console.warn('⚠️ Could not update assistant instructions:', updateError.message);
            // Continue anyway - assistant exists and can be used
          }
          
          return matchingAssistant.id;
        }
      } catch (error: any) {
        console.warn('⚠️ Error finding existing assistant:', error.message);
        // Continue to create new assistant
      }
    }

    // Generate name based on config
    const assistantName = config?.curriculum && config?.class && config?.subject
      ? (config.curriculum === 'RBSE' 
          ? `Class ${config.class} ${config.subject} RBSE`
          : `${config.curriculum} ${config.class} ${config.subject} Teacher`)
      : config?.name || 'LearnXR Teacher';

    const instructions = config?.instructions || this.generateInstructions(config);
    
    console.log(`🔧 Creating new assistant: ${assistantName}`);
    console.log(`📋 Instructions preview: ${instructions.substring(0, 200)}...`);

    try {
      const assistant = await this.openai.beta.assistants.create({
        name: assistantName,
        instructions: instructions,
        model: config?.model || 'gpt-4o-mini',
        tools: [
          {
            type: 'code_interpreter'
          }
        ]
      });

      // Cache the assistant ID
      this.assistants.set(assistantKey, assistant.id);
      console.log(`✅ Assistant created and cached: ${assistant.id} for key ${assistantKey}`);
      return assistant.id;
    } catch (createError: any) {
      console.error('❌ Error creating assistant:', createError);
      console.error('   Error message:', createError.message);
      console.error('   Error status:', createError.status);
      console.error('   Error code:', createError.code);
      
      // Don't cache failed assistants
      throw new Error(`Failed to create assistant "${assistantName}": ${createError.message || 'Unknown error'}`);
    }
  }

  /**
   * Create a thread for a conversation
   */
  async createThread(): Promise<string> {
    const thread = await this.openai.beta.threads.create();
    return thread.id;
  }

  /**
   * Cancel any active runs for a thread
   */
  private async cancelActiveRuns(threadId: string): Promise<void> {
    try {
      const runs = await this.openai.beta.threads.runs.list(threadId, { limit: 10 });
      const activeRuns = runs.data.filter(run => 
        run.status === 'queued' || run.status === 'in_progress'
      );
      
      if (activeRuns.length > 0) {
        console.log(`⚠️ Found ${activeRuns.length} active run(s), cancelling...`);
        await Promise.all(
          activeRuns.map(run => 
            this.openai.beta.threads.runs.cancel(threadId, run.id).catch(err => {
              console.warn(`⚠️ Failed to cancel run ${run.id}:`, err.message);
            })
          )
        );
        // Wait a bit for cancellation to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      console.warn('⚠️ Error checking/cancelling active runs:', error.message);
      // Continue anyway - might be a new thread with no runs
    }
  }

  /**
   * Send a message and get response
   */
  async sendMessage(threadId: string, message: string, config?: AssistantConfig): Promise<string> {
    // Check for and cancel any active runs first
    await this.cancelActiveRuns(threadId);

    // Get assistant ID with config FIRST (to ensure it's created with correct instructions)
    const assistantId = await this.getOrCreateAssistant(config);
    console.log(`📋 Using assistant ${assistantId} for thread ${threadId}`);
    
    // Add user message with STRONG context prefix to reinforce the curriculum/class/subject
    // This ensures the assistant sees the context in the conversation itself
    let messageWithContext = message;
    if (config?.curriculum && config?.class && config?.subject) {
      // Prepend STRONG context to the message so the assistant always sees it
      messageWithContext = `⚠️ CONTEXT: You are teaching ${config.subject} to Class ${config.class} students following ${config.curriculum} curriculum. The student's question below is about ${config.subject} for Class ${config.class} in ${config.curriculum} curriculum. Answer directly without asking about subject/class/curriculum.

Student's question: ${message}`;
    }
    
    try {
      await this.openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: messageWithContext
      });
      console.log(`✅ Message added to thread ${threadId}`);
    } catch (error: any) {
      console.error('❌ Failed to add message to thread:', error);
      throw new Error(`Failed to add message to thread: ${error.message || 'Unknown error'}`);
    }
    
    console.log(`📤 Sent message to thread ${threadId} with assistant ${assistantId}`);
    if (config?.curriculum && config?.class && config?.subject) {
      console.log(`📚 Context: ${config.curriculum} - Class ${config.class} - ${config.subject}`);
    }

    // Run the assistant
    let run;
    try {
      console.log(`🚀 Creating run for assistant ${assistantId} in thread ${threadId}`);
      run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId
      });
      console.log(`✅ Run created: ${run.id} with status: ${run.status}`);
    } catch (error: any) {
      console.error('❌ Failed to create run:', error);
      console.error('   Error message:', error.message);
      console.error('   Error status:', error.status);
      console.error('   Error code:', error.code);
      
      // If we still get an active run error, wait a bit and try cancelling again
      if (error.message?.includes('already has an active run') || error.status === 400) {
        console.log('⚠️ Still has active run, waiting and retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.cancelActiveRuns(threadId);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Retry creating the run
        try {
          run = await this.openai.beta.threads.runs.create(threadId, {
            assistant_id: assistantId
          });
          console.log(`✅ Run created after retry: ${run.id}`);
        } catch (retryError: any) {
          console.error('❌ Retry also failed:', retryError);
          throw new Error(`Failed to create assistant run: ${retryError.message || 'Unknown error'}`);
        }
      } else {
        throw new Error(`Failed to create assistant run: ${error.message || 'Unknown error'}`);
      }
    }

    // Wait for completion
    let runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
    let waitCount = 0;
    const maxWaitTime = 60000; // 60 seconds max wait
    const startTime = Date.now();
    
    while ((runStatus.status === 'queued' || runStatus.status === 'in_progress') && 
           (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await this.openai.beta.threads.runs.retrieve(threadId, run.id);
      waitCount++;
      
      // Log progress every 10 checks
      if (waitCount % 10 === 0) {
        console.log(`Waiting for run completion... (${waitCount * 0.5}s)`);
      }
    }

    if (runStatus.status === 'completed') {
      // Retrieve messages
      const messages = await this.openai.beta.threads.messages.list(threadId);
      const assistantMessage = messages.data.find(
        (msg: any) => msg.role === 'assistant' && (msg as any).run_id === run.id
      );
      
      if (assistantMessage) {
        // Handle different content types
        const content = (assistantMessage as any).content;
        if (Array.isArray(content) && content.length > 0) {
          const textContent = content.find((c: any) => c.type === 'text');
          if (textContent && textContent.text) {
            console.log('✅ Assistant response received');
            return textContent.text.value;
          }
        }
        // Fallback: try to get text value directly
        if ((assistantMessage as any).content?.[0]?.text?.value) {
          return (assistantMessage as any).content[0].text.value;
        }
      }
      
      console.error('❌ Could not extract assistant message from response');
      console.error('   Run status:', runStatus.status);
      console.error('   Messages found:', messages.data.length);
      console.error('   Assistant message:', assistantMessage ? 'found' : 'not found');
      throw new Error('Assistant response received but could not extract text content');
    }

    // Handle other run statuses
    if (runStatus.status === 'failed') {
      const lastError = (runStatus as any).last_error;
      console.error('❌ Assistant run failed');
      console.error('   Run ID:', run.id);
      console.error('   Thread ID:', threadId);
      console.error('   Assistant ID:', assistantId);
      console.error('   Error object:', JSON.stringify(lastError, null, 2));
      console.error('   Full run status:', JSON.stringify(runStatus, null, 2));
      
      // Provide more detailed error message
      const errorMessage = lastError?.message || 'Unknown error';
      const errorCode = lastError?.code || 'no_code';
      const errorType = lastError?.type || 'unknown_type';
      
      // Log all available error information
      console.error('   Error message:', errorMessage);
      console.error('   Error code:', errorCode);
      console.error('   Error type:', errorType);
      
      // Check for common error types and provide helpful messages
      if (errorCode === 'rate_limit_exceeded' || errorMessage?.includes('rate_limit')) {
        throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
      } else if (errorCode === 'invalid_api_key' || errorMessage?.includes('invalid_api_key') || errorMessage?.includes('authentication')) {
        throw new Error('Invalid OpenAI API key. Please check your API key configuration.');
      } else if (errorMessage?.includes('quota') || errorCode === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded. Please check your account billing.');
      } else if (errorMessage?.includes('assistant') || errorCode === 'invalid_assistant') {
        throw new Error('Invalid assistant configuration. The assistant may not exist or be misconfigured.');
      } else if (errorMessage?.includes('model') || errorCode === 'invalid_model') {
        throw new Error('Invalid model configuration. Please check the assistant model settings.');
      } else {
        // Provide the most detailed error message possible
        const detailedError = errorMessage !== 'failed' 
          ? `Assistant run failed: ${errorMessage} (Code: ${errorCode}, Type: ${errorType})`
          : `Assistant run failed with code: ${errorCode}, type: ${errorType}. Check server logs for details.`;
        throw new Error(detailedError);
      }
    }

    if (runStatus.status === 'cancelled') {
      console.warn('⚠️ Assistant run was cancelled');
      throw new Error('Assistant run was cancelled. Please try again.');
    }

    if (runStatus.status === 'expired') {
      console.warn('⚠️ Assistant run expired');
      throw new Error('Assistant run expired. Please try again.');
    }

    if (runStatus.status === 'requires_action') {
      console.warn('⚠️ Assistant run requires action');
      throw new Error('Assistant run requires action. This feature is not yet supported.');
    }

    console.error('❌ Unexpected run status:', runStatus.status);
    console.error('   Full run status:', JSON.stringify(runStatus, null, 2));
    throw new Error(`Assistant run ended with unexpected status: ${runStatus.status}`);
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
    // Pattern 1: "Class {number}th {Subject} RBSE" (with ordinal suffix like "10th", "9th")
    // Example: "Class 10th Social Science RBSE" or "Class 9th Social Science RBSE"
    // This pattern matches "10th" as one word (no space between number and "th")
    const classPattern1 = /^CLASS\s+(\d+)(?:TH|ST|ND|RD)\s+(.+?)\s+RBSE$/i;
    const match1 = name.match(classPattern1);
    if (match1) {
      const classNum = this.normalizeClass(match1[1]);
      const subjectStr = match1[2].trim();
      const subject = this.normalizeSubject(subjectStr);
      
      console.log(`🔍 RBSE Pattern 1 (with ordinal) match for "${name}": class=${classNum}, subjectStr="${subjectStr}", normalizedSubject=${subject}`);
      
      if (classNum && subject) {
        return { curriculum: 'RBSE', class: classNum, subject };
      } else {
        console.warn(`⚠️ RBSE Pattern 1 matched but normalization failed: classNum=${classNum}, subject=${subject}`);
      }
    }
    
    // Pattern 2: "Class {number} {Subject} RBSE" - Standard format without ordinal
    // Example: "Class 10 Hindi RBSE" or "Class 9 Mathematics RBSE"
    const classPattern2 = /^CLASS\s+(\d+)\s+(.+?)\s+RBSE$/i;
    const match2 = name.match(classPattern2);
    if (match2 && !match1) { // Only if pattern 1 didn't match
      const classNum = this.normalizeClass(match2[1]);
      const subjectStr = match2[2].trim();
      const subject = this.normalizeSubject(subjectStr);
      
      console.log(`🔍 RBSE Pattern 2 (standard) match for "${name}": class=${classNum}, subjectStr="${subjectStr}", normalizedSubject=${subject}`);
      
      if (classNum && subject) {
        return { curriculum: 'RBSE', class: classNum, subject };
      } else {
        console.warn(`⚠️ RBSE Pattern 2 matched but normalization failed: classNum=${classNum}, subject=${subject}`);
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
