// Test Suite for Prompt Analyzer
// Run this to test and improve the analyzer

import { promptParserService, type ParsedPrompt } from './promptParserService';

interface TestCase {
  prompt: string;
  expectedType: 'mesh' | 'skybox' | 'both' | 'unknown';
  expectedMeshScore: { min: number; max: number };
  expectedSkyboxScore: { min: number; max: number };
  description: string;
}

const testCases: TestCase[] = [
  // Pure Skybox Prompts
  {
    prompt: "A futuristic cityscape with flying vehicles and neon signs reflecting in puddles during a cyberpunk rainstorm at night",
    expectedType: 'skybox',
    expectedMeshScore: { min: 0, max: 0.25 },
    expectedSkyboxScore: { min: 0.75, max: 1.0 },
    description: "Pure skybox - environment with descriptive objects"
  },
  {
    prompt: "360° panoramic view of a mystical forest at sunset with ancient oak trees, dappled sunlight filtering through mist",
    expectedType: 'skybox',
    expectedMeshScore: { min: 0, max: 0.2 },
    expectedSkyboxScore: { min: 0.85, max: 1.0 },
    description: "Pure skybox - explicit 360° panorama"
  },
  {
    prompt: "A cozy library room with floor-to-ceiling bookshelves, warm fireplace casting flickering shadows, rain pattering against large windows",
    expectedType: 'skybox',
    expectedMeshScore: { min: 0, max: 0.3 },
    expectedSkyboxScore: { min: 0.7, max: 1.0 },
    description: "Pure skybox - indoor environment"
  },
  {
    prompt: "Panoramic landscape of a desert at dawn with sand dunes stretching to the horizon, warm golden light",
    expectedType: 'skybox',
    expectedMeshScore: { min: 0, max: 0.2 },
    expectedSkyboxScore: { min: 0.8, max: 1.0 },
    description: "Pure skybox - landscape panorama"
  },
  {
    prompt: "A cyberpunk street scene at night with neon lights, holographic advertisements, and flying cars in the background",
    expectedType: 'skybox',
    expectedMeshScore: { min: 0, max: 0.25 },
    expectedSkyboxScore: { min: 0.75, max: 1.0 },
    description: "Pure skybox - street scene with background elements"
  },

  // Pure Mesh Prompts
  {
    prompt: "A detailed medieval fantasy sword with intricate runic engravings, ornate hilt wrapped in leather, and a glowing crystal embedded in the pommel",
    expectedType: 'mesh',
    expectedMeshScore: { min: 0.75, max: 1.0 },
    expectedSkyboxScore: { min: 0, max: 0.25 },
    description: "Pure mesh - detailed object description"
  },
  {
    prompt: "A vintage 1950s red convertible car, highly detailed 3D model with chrome accents and leather interior",
    expectedType: 'mesh',
    expectedMeshScore: { min: 0.8, max: 1.0 },
    expectedSkyboxScore: { min: 0, max: 0.2 },
    description: "Pure mesh - vehicle object with explicit 3D mention"
  },
  {
    prompt: "An ornate crystal vase with intricate patterns, detailed sculpture",
    expectedType: 'mesh',
    expectedMeshScore: { min: 0.7, max: 1.0 },
    expectedSkyboxScore: { min: 0, max: 0.3 },
    description: "Pure mesh - decorative object"
  },
  {
    prompt: "A robotic character model with mechanical joints and LED eyes, high poly mesh",
    expectedType: 'mesh',
    expectedMeshScore: { min: 0.85, max: 1.0 },
    expectedSkyboxScore: { min: 0, max: 0.15 },
    description: "Pure mesh - character with explicit mesh mention"
  },
  {
    prompt: "A wooden chair with carved details and leather upholstery",
    expectedType: 'mesh',
    expectedMeshScore: { min: 0.7, max: 1.0 },
    expectedSkyboxScore: { min: 0, max: 0.3 },
    description: "Pure mesh - furniture object"
  },

  // Both Prompts
  {
    prompt: "A majestic stone statue of a dragon warrior standing on a pedestal in the center of an ancient temple courtyard, surrounded by crumbling pillars and overgrown vines, with dramatic storm clouds gathering overhead at twilight",
    expectedType: 'both',
    expectedMeshScore: { min: 0.4, max: 0.7 },
    expectedSkyboxScore: { min: 0.4, max: 0.7 },
    description: "Both - statue object in environment"
  },
  {
    prompt: "A vintage 1950s red convertible car parked on a beach at sunset, with palm trees swaying in the background, ocean waves crashing nearby",
    expectedType: 'both',
    expectedMeshScore: { min: 0.4, max: 0.65 },
    expectedSkyboxScore: { min: 0.45, max: 0.7 },
    description: "Both - car object in beach environment"
  },
  {
    prompt: "A medieval table in a fantasy forest at sunset with magical glowing mushrooms",
    expectedType: 'both',
    expectedMeshScore: { min: 0.35, max: 0.6 },
    expectedSkyboxScore: { min: 0.4, max: 0.65 },
    description: "Both - furniture in environment"
  },
  {
    prompt: "A crystal chandelier hanging in a grand ballroom with marble floors and ornate columns",
    expectedType: 'both',
    expectedMeshScore: { min: 0.35, max: 0.6 },
    expectedSkyboxScore: { min: 0.4, max: 0.65 },
    description: "Both - chandelier in room environment"
  },

  // Edge Cases
  {
    prompt: "Flying vehicles in a futuristic city",
    expectedType: 'skybox',
    expectedMeshScore: { min: 0, max: 0.3 },
    expectedSkyboxScore: { min: 0.6, max: 1.0 },
    description: "Edge case - objects mentioned but environment is focus"
  },
  {
    prompt: "A car",
    expectedType: 'mesh',
    expectedMeshScore: { min: 0.5, max: 1.0 },
    expectedSkyboxScore: { min: 0, max: 0.4 },
    description: "Edge case - very short object prompt"
  },
  {
    prompt: "A room with furniture",
    expectedType: 'skybox',
    expectedMeshScore: { min: 0, max: 0.4 },
    expectedSkyboxScore: { min: 0.5, max: 1.0 },
    description: "Edge case - room is primary, furniture is descriptive"
  },
  {
    prompt: "A detailed 3D model of a spaceship",
    expectedType: 'mesh',
    expectedMeshScore: { min: 0.85, max: 1.0 },
    expectedSkyboxScore: { min: 0, max: 0.2 },
    description: "Edge case - explicit 3D model mention"
  },
  {
    prompt: "An environment showing a space station with corridors and control rooms",
    expectedType: 'skybox',
    expectedMeshScore: { min: 0, max: 0.25 },
    expectedSkyboxScore: { min: 0.75, max: 1.0 },
    description: "Edge case - explicit environment mention"
  }
];

function testAnalyzer() {
  console.log('🧪 Testing Prompt Analyzer\n');
  console.log('='.repeat(80));
  
  let passed = 0;
  let failed = 0;
  const failures: Array<{ prompt: string; expected: string; actual: string; scores: any }> = [];

  testCases.forEach((testCase, index) => {
    const result = promptParserService.parsePrompt(testCase.prompt);
    
    const typeMatch = result.promptType === testCase.expectedType;
    const meshScoreMatch = result.meshScore >= testCase.expectedMeshScore.min && 
                          result.meshScore <= testCase.expectedMeshScore.max;
    const skyboxScoreMatch = result.skyboxScore >= testCase.expectedSkyboxScore.min && 
                            result.skyboxScore <= testCase.expectedSkyboxScore.max;
    
    const passedTest = typeMatch && meshScoreMatch && skyboxScoreMatch;
    
    if (passedTest) {
      passed++;
      console.log(`✅ Test ${index + 1}: PASSED`);
    } else {
      failed++;
      failures.push({
        prompt: testCase.prompt,
        expected: testCase.expectedType,
        actual: result.promptType,
        scores: { mesh: result.meshScore, skybox: result.skyboxScore }
      });
      console.log(`❌ Test ${index + 1}: FAILED`);
    }
    
    console.log(`   Prompt: "${testCase.prompt.substring(0, 60)}${testCase.prompt.length > 60 ? '...' : ''}"`);
    console.log(`   Expected: ${testCase.expectedType} (mesh: ${testCase.expectedMeshScore.min}-${testCase.expectedMeshScore.max}, skybox: ${testCase.expectedSkyboxScore.min}-${testCase.expectedSkyboxScore.max})`);
    console.log(`   Actual: ${result.promptType} (mesh: ${result.meshScore.toFixed(2)}, skybox: ${result.skyboxScore.toFixed(2)})`);
    console.log(`   Description: ${testCase.description}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`\n📊 Test Results: ${passed}/${testCases.length} passed, ${failed} failed`);
  console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);

  if (failures.length > 0) {
    console.log('❌ Failed Tests:');
    failures.forEach((failure, index) => {
      console.log(`\n${index + 1}. "${failure.prompt}"`);
      console.log(`   Expected: ${failure.expected}, Got: ${failure.actual}`);
      console.log(`   Scores: mesh=${failure.scores.mesh.toFixed(2)}, skybox=${failure.scores.skybox.toFixed(2)}`);
    });
  }

  return { passed, failed, failures, total: testCases.length };
}

// Export for use in development
export { testAnalyzer, testCases };

// Run if executed directly
if (typeof window === 'undefined' && require.main === module) {
  testAnalyzer();
}

