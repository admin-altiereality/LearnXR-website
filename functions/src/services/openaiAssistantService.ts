import OpenAI from 'openai';

interface AssistantConfig {
  name?: string;
  instructions?: string;
  model?: string;
}

class OpenAIAssistantService {
  private openai: OpenAI;
  private assistantId: string | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
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
}

export default OpenAIAssistantService;

