/**
 * Script to create test assistants for verification
 * Run with: npx tsx server/scripts/create-test-assistants.ts [--avatar]
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAIAssistantService from '../src/services/openaiAssistantService';

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

// Test configurations to create
const testConfigs = [
  { curriculum: 'NCERT', class: '10', subject: 'Mathematics' },
  { curriculum: 'NCERT', class: '10', subject: 'Science' },
  { curriculum: 'NCERT', class: '5', subject: 'Mathematics' },
  { curriculum: 'CBSE', class: '12', subject: 'Physics' },
  { curriculum: 'CBSE', class: '12', subject: 'Chemistry' },
  { curriculum: 'CBSE', class: '8', subject: 'Science' },
  { curriculum: 'ICSE', class: '9', subject: 'Mathematics' },
];

async function createTestAssistants() {
  try {
    const useAvatarKey = process.argv.includes('--avatar') || process.argv.includes('-a');
    console.log('🔍 Creating test assistants...\n');
    console.log('🔑 Using Avatar Key:', useAvatarKey);
    console.log('');
    
    const service = new OpenAIAssistantService(useAvatarKey);
    
    console.log(`📝 Creating ${testConfigs.length} test assistant(s)...\n`);
    
    const results = [];
    
    for (const config of testConfigs) {
      try {
        console.log(`Creating: ${config.curriculum} Class ${config.class} ${config.subject}...`);
        const assistantId = await service.getOrCreateAssistant(config);
        results.push({ ...config, assistantId, success: true });
        console.log(`✅ Created: ${assistantId}\n`);
      } catch (error: any) {
        console.error(`❌ Failed: ${error.message}\n`);
        results.push({ ...config, error: error.message, success: false });
      }
    }
    
    console.log('═'.repeat(60));
    console.log('\n📊 Summary:\n');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successfully created: ${successful.length}`);
    successful.forEach(r => {
      console.log(`   • ${r.curriculum} Class ${r.class} ${r.subject} (${r.assistantId})`);
    });
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed: ${failed.length}`);
      failed.forEach(r => {
        console.log(`   • ${r.curriculum} Class ${r.class} ${r.subject}: ${r.error}`);
      });
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('\n🔍 Now checking available assistants...\n');
    
    // Now list all available assistants
    const available = await service.listAvailableAssistants();
    
    console.log(`✅ Found ${available.length} available assistant(s)\n`);
    
    if (available.length > 0) {
      // Group by curriculum
      const grouped = available.reduce((acc, config) => {
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
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('API key')) {
      console.error('   Please check your OPENAI_AVATAR_API_KEY or OPENAI_API_KEY environment variable');
    }
    process.exit(1);
  }
}

createTestAssistants();

