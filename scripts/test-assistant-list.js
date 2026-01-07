/**
 * Quick test script to check available assistants
 * This directly uses the OpenAI service (requires OPENAI_AVATAR_API_KEY)
 */

// Load environment variables
require('dotenv').config();

const OpenAI = require('openai').default;

// Constants
const CURRICULUMS = ['NCERT', 'CBSE', 'ICSE', 'State Board'];
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

async function listAssistants() {
  try {
    const apiKey = process.env.OPENAI_AVATAR_API_KEY || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ Error: OPENAI_AVATAR_API_KEY or OPENAI_API_KEY not found in environment');
      console.error('   Please set one of these environment variables');
      process.exit(1);
    }
    
    console.log('🔍 Fetching assistants from OpenAI...');
    console.log('🔑 Using API Key:', apiKey.substring(0, 10) + '...');
    console.log('');
    
    const openai = new OpenAI({ apiKey });
    const assistants = await openai.beta.assistants.list({ limit: 100 });
    
    console.log(`📋 Found ${assistants.data.length} total assistant(s) in OpenAI\n`);
    
    const availableConfigs = [];
    
    // Parse assistant names
    for (const assistant of assistants.data) {
      if (assistant.name && assistant.name.endsWith(' Teacher')) {
        const nameWithoutSuffix = assistant.name.replace(' Teacher', '').trim();
        
        for (const curriculum of CURRICULUMS) {
          if (nameWithoutSuffix.startsWith(curriculum + ' ')) {
            const afterCurriculum = nameWithoutSuffix.substring(curriculum.length + 1).trim();
            
            for (const classLevel of CLASSES) {
              if (afterCurriculum.startsWith(classLevel + ' ')) {
                const subject = afterCurriculum.substring(classLevel.length + 1).trim();
                
                if (SUBJECTS.includes(subject)) {
                  availableConfigs.push({
                    curriculum,
                    class: classLevel,
                    subject
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
    
    console.log(`✅ Found ${availableConfigs.length} valid assistant configuration(s)\n`);
    
    if (availableConfigs.length === 0) {
      console.log('⚠️  No valid assistants found.');
      console.log('   Assistants should be named: "{Curriculum} {Class} {Subject} Teacher"');
      console.log('   Example: "NCERT 10 Mathematics Teacher"\n');
      
      // Show all assistants for debugging
      console.log('📋 All assistants found:');
      assistants.data.forEach(a => {
        console.log(`   - ${a.name || '(no name)'} (ID: ${a.id})`);
      });
      return;
    }
    
    // Group by curriculum
    const grouped = availableConfigs.reduce((acc, config) => {
      const { curriculum, class: classLevel, subject } = config;
      if (!acc[curriculum]) {
        acc[curriculum] = {};
      }
      if (!acc[curriculum][classLevel]) {
        acc[curriculum][classLevel] = [];
      }
      acc[curriculum][classLevel].push(subject);
      return acc;
    }, {});
    
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
    console.log(`\n📊 Summary: ${availableConfigs.length} total combination(s)`);
    
    const uniqueCurriculums = new Set(availableConfigs.map(a => a.curriculum)).size;
    const uniqueClasses = new Set(availableConfigs.map(a => a.class)).size;
    const uniqueSubjects = new Set(availableConfigs.map(a => a.subject)).size;
    
    console.log(`   • ${uniqueCurriculums} unique curriculum(s)`);
    console.log(`   • ${uniqueClasses} unique class(es)`);
    console.log(`   • ${uniqueSubjects} unique subject(s)`);
    
    // JSON output
    if (process.argv.includes('--json') || process.argv.includes('-j')) {
      console.log('\n📄 JSON Output:');
      console.log(JSON.stringify(availableConfigs, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status === 401) {
      console.error('   Invalid API key. Please check your OPENAI_AVATAR_API_KEY or OPENAI_API_KEY');
    }
    process.exit(1);
  }
}

listAssistants();

