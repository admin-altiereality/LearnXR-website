/**
 * Script to list ALL assistants in OpenAI account (including non-teacher assistants)
 * Run with: npx tsx server/scripts/list-all-assistants.ts [--avatar]
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env')
];

for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log(`📁 Loaded .env from: ${envPath}`);
    break;
  }
}

async function listAllAssistants() {
  try {
    const useAvatarKey = process.argv.includes('--avatar') || process.argv.includes('-a');
    console.log('🔍 Listing ALL assistants from OpenAI...\n');
    console.log('🔑 Using Avatar Key:', useAvatarKey);
    console.log('');
    
    // Get API key
    let apiKey: string | undefined;
    if (useAvatarKey) {
      apiKey = process.env.OPENAI_AVATAR_API_KEY || process.env.OPENAI_API_KEY;
      if (process.env.OPENAI_AVATAR_API_KEY) {
        console.log('✅ Using OPENAI_AVATAR_API_KEY');
      } else {
        console.log('⚠️ OPENAI_AVATAR_API_KEY not found, using OPENAI_API_KEY');
      }
    } else {
      apiKey = process.env.OPENAI_API_KEY;
    }
    
    if (!apiKey) {
      throw new Error('API key not found. Please set OPENAI_AVATAR_API_KEY or OPENAI_API_KEY');
    }
    
    const openai = new OpenAI({ apiKey });
    
    console.log('📋 Fetching all assistants...\n');
    const assistants = await openai.beta.assistants.list({ limit: 100 });
    
    console.log(`✅ Found ${assistants.data.length} total assistant(s) in OpenAI account\n`);
    console.log('═'.repeat(80));
    
    if (assistants.data.length === 0) {
      console.log('⚠️  No assistants found in your OpenAI account.');
      return;
    }
    
    // Separate teacher assistants from others
    const teacherAssistants: any[] = [];
    const otherAssistants: any[] = [];
    
    assistants.data.forEach(assistant => {
      if (assistant.name && assistant.name.endsWith(' Teacher')) {
        teacherAssistants.push(assistant);
      } else {
        otherAssistants.push(assistant);
      }
    });
    
    // Display teacher assistants
    if (teacherAssistants.length > 0) {
      console.log(`\n📚 Teacher Assistants (${teacherAssistants.length}):\n`);
      console.log('─'.repeat(80));
      
      teacherAssistants.forEach((assistant, index) => {
        console.log(`\n${index + 1}. ${assistant.name || '(No name)'}`);
        console.log(`   ID: ${assistant.id}`);
        console.log(`   Model: ${assistant.model}`);
        console.log(`   Created: ${new Date(assistant.created_at * 1000).toLocaleString()}`);
        if (assistant.description) {
          console.log(`   Description: ${assistant.description.substring(0, 100)}...`);
        }
      });
    }
    
    // Display other assistants
    if (otherAssistants.length > 0) {
      console.log(`\n\n🔧 Other Assistants (${otherAssistants.length}):\n`);
      console.log('─'.repeat(80));
      
      otherAssistants.forEach((assistant, index) => {
        console.log(`\n${index + 1}. ${assistant.name || '(No name)'}`);
        console.log(`   ID: ${assistant.id}`);
        console.log(`   Model: ${assistant.model}`);
        console.log(`   Created: ${new Date(assistant.created_at * 1000).toLocaleString()}`);
        if (assistant.description) {
          console.log(`   Description: ${assistant.description.substring(0, 100)}...`);
        }
      });
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   • Total assistants: ${assistants.data.length}`);
    console.log(`   • Teacher assistants: ${teacherAssistants.length}`);
    console.log(`   • Other assistants: ${otherAssistants.length}`);
    
    // Show valid teacher assistant configurations
    if (teacherAssistants.length > 0) {
      console.log(`\n✅ Valid Teacher Assistant Configurations:\n`);
      
      const CURRICULUMS = ['NCERT', 'CBSE', 'ICSE', 'State Board'];
      const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      const SUBJECTS = [
        'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies',
        'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Computer Science'
      ];
      
      const validConfigs: Array<{ curriculum: string; class: string; subject: string }> = [];
      
      for (const assistant of teacherAssistants) {
        if (assistant.name && assistant.name.endsWith(' Teacher')) {
          const nameWithoutSuffix = assistant.name.replace(' Teacher', '').trim();
          
          for (const curriculum of CURRICULUMS) {
            if (nameWithoutSuffix.startsWith(curriculum + ' ')) {
              const afterCurriculum = nameWithoutSuffix.substring(curriculum.length + 1).trim();
              
              for (const classLevel of CLASSES) {
                if (afterCurriculum.startsWith(classLevel + ' ')) {
                  const subject = afterCurriculum.substring(classLevel.length + 1).trim();
                  
                  if (SUBJECTS.includes(subject)) {
                    validConfigs.push({ curriculum, class: classLevel, subject });
                    break;
                  }
                }
              }
              break;
            }
          }
        }
      }
      
      if (validConfigs.length > 0) {
        // Group by curriculum
        const grouped = validConfigs.reduce((acc, config) => {
          const { curriculum, class: classLevel, subject } = config;
          if (!acc[curriculum]) {
            acc[curriculum] = {};
          }
          if (!acc[curriculum][classLevel]) {
            acc[curriculum][classLevel] = [];
          }
          acc[curriculum][classLevel].push(subject);
          return acc;
        }, {} as Record<string, Record<string, string[]>>);
        
        Object.keys(grouped).sort().forEach(curriculum => {
          console.log(`📖 ${curriculum}`);
          Object.keys(grouped[curriculum]).sort((a, b) => parseInt(a) - parseInt(b)).forEach(classLevel => {
            const subjects = grouped[curriculum][classLevel].sort();
            console.log(`   Class ${classLevel}: ${subjects.join(', ')}`);
          });
        });
      }
    }
    
    // JSON output option
    if (process.argv.includes('--json') || process.argv.includes('-j')) {
      console.log('\n\n📄 JSON Output:');
      console.log(JSON.stringify({
        total: assistants.data.length,
        teacherAssistants: teacherAssistants.map(a => ({
          id: a.id,
          name: a.name,
          model: a.model,
          created: new Date(a.created_at * 1000).toISOString()
        })),
        otherAssistants: otherAssistants.map(a => ({
          id: a.id,
          name: a.name,
          model: a.model,
          created: new Date(a.created_at * 1000).toISOString()
        }))
      }, null, 2));
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.status === 401) {
      console.error('   Invalid API key. Please check your API key configuration.');
    }
    process.exit(1);
  }
}

listAllAssistants();

