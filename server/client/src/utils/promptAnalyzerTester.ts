// Prompt Analyzer Test Utility
// Use this in browser console: window.testPromptAnalyzer()

import { promptParserService } from '../services/promptParserService';
import type { PromptType } from '../services/promptParserService';

interface TestPrompt {
  prompt: string;
  expectedType: PromptType;
  description: string;
}

const testPrompts: TestPrompt[] = [
  // Pure Skybox
  {
    prompt: "A futuristic cityscape with flying vehicles and neon signs reflecting in puddles during a cyberpunk rainstorm at night",
    expectedType: 'skybox',
    description: "Pure skybox - environment with descriptive objects"
  },
  {
    prompt: "360° panoramic view of a mystical forest at sunset with ancient oak trees",
    expectedType: 'skybox',
    description: "Pure skybox - explicit 360° panorama"
  },
  {
    prompt: "A cozy library room with floor-to-ceiling bookshelves and warm fireplace",
    expectedType: 'skybox',
    description: "Pure skybox - indoor environment"
  },
  {
    prompt: "Panoramic landscape of a desert at dawn with sand dunes stretching to the horizon",
    expectedType: 'skybox',
    description: "Pure skybox - landscape panorama"
  },
  {
    prompt: "A cyberpunk street scene at night with neon lights and holographic advertisements",
    expectedType: 'skybox',
    description: "Pure skybox - street scene"
  },
  {
    prompt: "Flying vehicles in a futuristic city",
    expectedType: 'skybox',
    description: "Edge case - objects mentioned but environment is focus"
  },
  {
    prompt: "A room with furniture",
    expectedType: 'skybox',
    description: "Edge case - room is primary"
  },
  
  // Pure Mesh
  {
    prompt: "A detailed medieval fantasy sword with intricate runic engravings",
    expectedType: 'mesh',
    description: "Pure mesh - detailed object"
  },
  {
    prompt: "A vintage 1950s red convertible car, highly detailed 3D model",
    expectedType: 'mesh',
    description: "Pure mesh - vehicle with explicit 3D mention"
  },
  {
    prompt: "An ornate crystal vase with intricate patterns",
    expectedType: 'mesh',
    description: "Pure mesh - decorative object"
  },
  {
    prompt: "A robotic character model with mechanical joints and LED eyes",
    expectedType: 'mesh',
    description: "Pure mesh - character model"
  },
  {
    prompt: "A wooden chair with carved details and leather upholstery",
    expectedType: 'mesh',
    description: "Pure mesh - furniture object"
  },
  {
    prompt: "A car",
    expectedType: 'mesh',
    description: "Edge case - very short object prompt"
  },
  {
    prompt: "A detailed 3D model of a spaceship",
    expectedType: 'mesh',
    description: "Edge case - explicit 3D model mention"
  },
  
  // Both
  {
    prompt: "A majestic stone statue of a dragon warrior standing on a pedestal in the center of an ancient temple courtyard",
    expectedType: 'both',
    description: "Both - statue object in environment"
  },
  {
    prompt: "A vintage 1950s red convertible car parked on a beach at sunset",
    expectedType: 'both',
    description: "Both - car object in beach environment"
  },
  {
    prompt: "A medieval table in a fantasy forest at sunset",
    expectedType: 'both',
    description: "Both - furniture in environment"
  },
  {
    prompt: "A crystal chandelier hanging in a grand ballroom with marble floors",
    expectedType: 'both',
    description: "Both - chandelier in room environment"
  }
];

export function testPromptAnalyzer(): void {
  console.log('🧪 Testing Prompt Analyzer\n');
  console.log('='.repeat(80));
  
  const results = promptParserService.testAnalyzer(testPrompts);
  
  results.results.forEach((result, index) => {
    const testCase = testPrompts[index];
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? 'PASSED' : 'FAILED';
    
    console.log(`${icon} Test ${index + 1}: ${status}`);
    console.log(`   Prompt: "${testCase.prompt.substring(0, 70)}${testCase.prompt.length > 70 ? '...' : ''}"`);
    console.log(`   Expected: ${result.expected} | Actual: ${result.actual}`);
    console.log(`   Scores: Mesh=${(result.meshScore * 100).toFixed(0)}% | Skybox=${(result.skyboxScore * 100).toFixed(0)}% | Confidence=${(result.confidence * 100).toFixed(0)}%`);
    console.log(`   Description: ${testCase.description}`);
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${results.summary.total}`);
  console.log(`   Passed: ${results.summary.passed}`);
  console.log(`   Failed: ${results.summary.failed}`);
  console.log(`   Accuracy: ${results.summary.accuracy.toFixed(1)}%\n`);
  
  if (results.summary.failed > 0) {
    console.log('❌ Failed Tests:');
    results.results
      .filter(r => !r.passed)
      .forEach((result, idx) => {
        const testCase = testPrompts[results.results.indexOf(result)];
        console.log(`\n${idx + 1}. "${testCase.prompt}"`);
        console.log(`   Expected: ${result.expected}, Got: ${result.actual}`);
        console.log(`   Mesh: ${(result.meshScore * 100).toFixed(0)}% | Skybox: ${(result.skyboxScore * 100).toFixed(0)}%`);
      });
  }
  
  return results;
}

// Make available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).testPromptAnalyzer = testPromptAnalyzer;
  (window as any).testPrompts = testPrompts;
}

