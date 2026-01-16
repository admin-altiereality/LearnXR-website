/**
 * Test Script Validation
 * Validates that test scripts are properly structured without requiring API keys
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Test Scripts...\n');

let errors = 0;
let warnings = 0;

// Check if test scripts exist
const testScripts = [
  { name: 'Node.js Test Script', path: 'scripts/test-api.js' },
  { name: 'Bash Test Script', path: 'scripts/test-api.sh' }
];

testScripts.forEach(script => {
  const fullPath = path.join(process.cwd(), script.path);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${script.name} exists`);
    
    // Check file size (should not be empty)
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      console.log(`   ❌ ${script.name} is empty`);
      errors++;
    } else {
      console.log(`   ✓ File size: ${stats.size} bytes`);
    }
  } else {
    console.log(`❌ ${script.name} not found at ${script.path}`);
    errors++;
  }
});

// Validate Node.js script syntax
console.log('\n📝 Validating Node.js script syntax...');
try {
  const nodeScript = fs.readFileSync('scripts/test-api.js', 'utf8');
  
  // Check for required functions
  const requiredFunctions = [
    'makeRequest',
    'testEndpoint',
    'runTests'
  ];
  
  requiredFunctions.forEach(func => {
    if (nodeScript.includes(`function ${func}`) || nodeScript.includes(`${func} =`)) {
      console.log(`   ✅ Function '${func}' found`);
    } else {
      console.log(`   ❌ Function '${func}' not found`);
      errors++;
    }
  });
  
  // Check for test categories
  const testCategories = [
    'SKYBOX',
    'MESHY',
    'ERROR HANDLING',
    'VALIDATION'
  ];
  
  testCategories.forEach(category => {
    if (nodeScript.includes(category)) {
      console.log(`   ✅ Test category '${category}' found`);
    } else {
      console.log(`   ⚠️  Test category '${category}' not found`);
      warnings++;
    }
  });
  
  // Check for proper error handling
  if (nodeScript.includes('try') && nodeScript.includes('catch')) {
    console.log(`   ✅ Error handling (try/catch) found`);
  } else {
    console.log(`   ⚠️  Limited error handling detected`);
    warnings++;
  }
  
  // Validate script can be parsed
  try {
    // Basic syntax check - try to require it (will fail if syntax errors)
    const vm = require('vm');
    vm.createScript(nodeScript);
    console.log(`   ✅ Script syntax is valid`);
  } catch (e) {
    console.log(`   ❌ Script syntax error: ${e.message}`);
    errors++;
  }
  
} catch (e) {
  console.log(`   ❌ Failed to read/validate Node.js script: ${e.message}`);
  errors++;
}

// Validate Bash script structure
console.log('\n📝 Validating Bash script structure...');
try {
  const bashScript = fs.readFileSync('scripts/test-api.sh', 'utf8');
  
  // Check for shebang
  if (bashScript.startsWith('#!/bin/bash') || bashScript.startsWith('#!/bin/sh')) {
    console.log(`   ✅ Shebang found`);
  } else {
    console.log(`   ⚠️  Shebang not found (may still work)`);
    warnings++;
  }
  
  // Check for test functions
  if (bashScript.includes('test_endpoint') || bashScript.includes('testEndpoint')) {
    console.log(`   ✅ Test function found`);
  } else {
    console.log(`   ⚠️  Test function not found`);
    warnings++;
  }
  
  // Check for test counters
  if (bashScript.includes('TESTS_PASSED') && bashScript.includes('TESTS_FAILED')) {
    console.log(`   ✅ Test counters found`);
  } else {
    console.log(`   ⚠️  Test counters not found`);
    warnings++;
  }
  
  // Check for summary
  if (bashScript.includes('Test Summary') || bashScript.includes('Summary')) {
    console.log(`   ✅ Test summary found`);
  } else {
    console.log(`   ⚠️  Test summary not found`);
    warnings++;
  }
  
  // Check for the bug fix (TESTS_PASSED should not use TESTS_FAILED)
  if (bashScript.includes('TESTS_PASSED=$((TESTS_FAILED + 1))')) {
    console.log(`   ❌ BUG FOUND: TESTS_PASSED incorrectly uses TESTS_FAILED`);
    errors++;
  } else {
    console.log(`   ✅ No bug detected (TESTS_PASSED uses correct variable)`);
  }
  
} catch (e) {
  console.log(`   ❌ Failed to read/validate Bash script: ${e.message}`);
  errors++;
}

// Check documentation
console.log('\n📚 Checking documentation...');
const docs = [
  'docs/TESTING_REPORT.md',
  'docs/API_TESTING_GUIDE.md',
  'docs/API_REFERENCE.md'
];

docs.forEach(doc => {
  const fullPath = path.join(process.cwd(), doc);
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${doc} exists`);
  } else {
    console.log(`   ⚠️  ${doc} not found`);
    warnings++;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Validation Summary');
console.log('='.repeat(50));
console.log(`✅ Errors: ${errors === 0 ? 'None' : errors}`);
console.log(`⚠️  Warnings: ${warnings === 0 ? 'None' : warnings}`);

if (errors === 0) {
  console.log('\n🎉 All critical validations passed!');
  console.log('\n📋 Next Steps:');
  console.log('1. Generate an API key from the Developer Portal');
  console.log('2. Set the IN3D_API_KEY environment variable:');
  console.log('   export IN3D_API_KEY="in3d_live_your_key_here"');
  console.log('3. Run the tests:');
  console.log('   node scripts/test-api.js');
  console.log('   OR');
  console.log('   ./scripts/test-api.sh');
  process.exit(0);
} else {
  console.log('\n❌ Validation failed. Please fix the errors above.');
  process.exit(1);
}
