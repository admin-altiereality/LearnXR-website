/**
 * Script to check available assistants directly using the service
 * Run with: npx tsx server/scripts/check-assistants.ts [--avatar]
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAIAssistantService from '../src/services/openaiAssistantService';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from multiple possible locations
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

async function checkAssistants() {
  try {
    console.log('🔍 Checking available assistants...\n');
    
    // Use avatar key
    const useAvatarKey = process.argv.includes('--avatar') || process.argv.includes('-a');
    console.log('🔑 Using Avatar Key:', useAvatarKey);
    console.log('');
    
    const service = new OpenAIAssistantService(useAvatarKey);
    const assistants = await service.listAvailableAssistants();
    
    console.log(`✅ Found ${assistants.length} available assistant configuration(s)\n`);
    
    if (assistants.length === 0) {
      console.log('⚠️  No assistants found.');
      console.log('   Make sure you have created assistants in OpenAI.');
      console.log('   Assistants should be named: "{Curriculum} {Class} {Subject} Teacher"');
      console.log('   Example: "NCERT 10 Mathematics Teacher"');
      return;
    }
    
    // Group by curriculum
    const grouped = assistants.reduce((acc, config) => {
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
    
    // Display
    console.log('📚 Available Assistant Configurations:\n');
    console.log('═'.repeat(60));
    
    Object.keys(grouped).sort().forEach(curriculum => {
      console.log(`\n📖 ${curriculum}`);
      console.log('─'.repeat(60));
      
      Object.keys(grouped[curriculum]).sort((a, b) => parseInt(a) - parseInt(b)).forEach(classLevel => {
        const subjects = grouped[curriculum][classLevel].sort();
        console.log(`  Class ${classLevel}:`);
        subjects.forEach(subject => {
          console.log(`    • ${subject}`);
        });
      });
    });
    
    console.log('\n' + '═'.repeat(60));
    console.log(`\n📊 Summary: ${assistants.length} total combination(s)`);
    
    const uniqueCurriculums = new Set(assistants.map(a => a.curriculum)).size;
    const uniqueClasses = new Set(assistants.map(a => a.class)).size;
    const uniqueSubjects = new Set(assistants.map(a => a.subject)).size;
    
    console.log(`   • ${uniqueCurriculums} unique curriculum(s)`);
    console.log(`   • ${uniqueClasses} unique class(es)`);
    console.log(`   • ${uniqueSubjects} unique subject(s)`);
    
    // JSON output
    if (process.argv.includes('--json') || process.argv.includes('-j')) {
      console.log('\n📄 JSON Output:');
      console.log(JSON.stringify(assistants, null, 2));
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('API key')) {
      console.error('   Please check your OPENAI_AVATAR_API_KEY or OPENAI_API_KEY environment variable');
    }
    process.exit(1);
  }
}

checkAssistants();

