/**
 * Script to list all available assistants and their configurations
 * Usage: node scripts/list-available-assistants.js [--avatar] [--json]
 * 
 * Requirements: Node.js 18+ (for native fetch) or install node-fetch:
 *   npm install node-fetch
 */

// Try to use native fetch (Node 18+) or require node-fetch
let fetch;
try {
  // Node 18+ has native fetch
  if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
  } else {
    // Fallback to node-fetch if available
    fetch = require('node-fetch');
  }
} catch (e) {
  console.error('❌ Error: fetch is not available. Please use Node.js 18+ or install node-fetch:');
  console.error('   npm install node-fetch');
  process.exit(1);
}

const getApiBaseUrl = () => {
  // Check for explicit API base URL from environment
  if (process.env.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }
  
  // Use local backend in development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5001/in3devoneuralai/us-central1/api';
  }
  
  // Use Firebase Functions in production
  const region = 'us-central1';
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'in3devoneuralai';
  return `https://${region}-${projectId}.cloudfunctions.net/api`;
};

async function listAvailableAssistants() {
  try {
    const apiUrl = getApiBaseUrl();
    const useAvatarKey = process.argv.includes('--avatar') || process.argv.includes('-a');
    const url = `${apiUrl}/assistant/list?useAvatarKey=${useAvatarKey}`;
    
    console.log('🔍 Fetching available assistants...');
    console.log('📍 API URL:', url);
    console.log('🔑 Using Avatar Key:', useAvatarKey);
    console.log('');
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const assistants = data.assistants || [];
    
    console.log(`✅ Found ${assistants.length} available assistant(s)\n`);
    
    if (assistants.length === 0) {
      console.log('⚠️  No assistants found. Make sure you have created assistants in OpenAI.');
      console.log('   Assistants should be named in the format: "{Curriculum} {Class} {Subject} Teacher"');
      console.log('   Example: "NCERT 10 Mathematics Teacher"');
      return;
    }
    
    // Group by curriculum
    const grouped = assistants.reduce((acc, assistant) => {
      const { curriculum, class: classLevel, subject } = assistant;
      if (!acc[curriculum]) {
        acc[curriculum] = {};
      }
      if (!acc[curriculum][classLevel]) {
        acc[curriculum][classLevel] = [];
      }
      acc[curriculum][classLevel].push(subject);
      return acc;
    }, {});
    
    // Display in a readable format
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
    
    // Show unique counts
    const uniqueCurriculums = new Set(assistants.map(a => a.curriculum)).size;
    const uniqueClasses = new Set(assistants.map(a => a.class)).size;
    const uniqueSubjects = new Set(assistants.map(a => a.subject)).size;
    
    console.log(`   • ${uniqueCurriculums} unique curriculum(s)`);
    console.log(`   • ${uniqueClasses} unique class(es)`);
    console.log(`   • ${uniqueSubjects} unique subject(s)`);
    
    // Export as JSON if requested
    if (process.argv.includes('--json') || process.argv.includes('-j')) {
      console.log('\n📄 JSON Output:');
      console.log(JSON.stringify(assistants, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error fetching available assistants:', error.message);
    console.error('\n💡 Tips:');
    console.error('   • Make sure your server is running');
    console.error('   • Check that OPENAI_API_KEY or OPENAI_AVATAR_API_KEY is configured');
    console.error('   • Verify the API endpoint is accessible');
    process.exit(1);
  }
}

// Run the script
listAvailableAssistants();

