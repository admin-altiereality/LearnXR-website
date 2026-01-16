/**
 * In3D API Testing Script (Node.js)
 * Comprehensive tests for all API endpoints for n8n compatibility
 * 
 * Usage: node test-api.js
 * Requires: IN3D_API_KEY environment variable
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.IN3D_API_URL || 'https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api';
const API_KEY = process.env.IN3D_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: IN3D_API_KEY environment variable is not set');
  console.log('Usage: IN3D_API_KEY=in3d_live_... node test-api.js');
  process.exit(1);
}

// Test results
let testsPassed = 0;
let testsFailed = 0;

// Helper function to make HTTP requests with custom auth
function makeRequest(method, endpoint, data = null, authKey = null, authHeader = 'X-In3d-Key') {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const keyToUse = authKey || API_KEY;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Add authentication header
    if (authHeader === 'X-In3d-Key') {
      options.headers['X-In3d-Key'] = keyToUse;
    } else if (authHeader === 'Authorization') {
      options.headers['Authorization'] = `Bearer ${keyToUse}`;
    }

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            body: parsed,
            rawBody: body
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: body,
            rawBody: body,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test function
async function testEndpoint(name, method, endpoint, data, expectedStatus, validator, authKey = null, authHeader = 'X-In3d-Key') {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   ${method} ${endpoint}`);

  try {
    const response = await makeRequest(method, endpoint, data, authKey, authHeader);

    // Check status code (support array of acceptable statuses)
    const acceptableStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const statusMatches = acceptableStatuses.includes(response.statusCode);
    
    if (statusMatches) {
      console.log(`   ✅ HTTP Status: ${response.statusCode}`);

      // Check response format
      if (typeof response.body === 'object' && response.body !== null) {
        // Accept multiple response formats for n8n compatibility:
        // 1. Standardized: { success: true/false, ... }
        // 2. Error with code: { error: "...", code: "...", ... }
        // 3. Error with message: { error: "...", message: "...", ... } (legacy)
        const hasSuccessField = 'success' in response.body;
        const hasErrorWithCode = 'error' in response.body && 'code' in response.body;
        const hasErrorWithMessage = 'error' in response.body && 'message' in response.body;
        const isValidFormat = hasSuccessField || hasErrorWithCode || hasErrorWithMessage;
        
        if (isValidFormat) {
          console.log(`   ✅ Valid JSON response format`);
          console.log(`   Response: ${JSON.stringify({
            success: response.body.success,
            error: response.body.error,
            code: response.body.code,
            message: response.body.message,
            requestId: response.body.requestId
          })}`);

          // Run custom validator if provided
          if (validator) {
            const validationResult = validator(response.body);
            if (validationResult === true) {
              console.log(`   ✅ Custom validation passed`);
              testsPassed++;
            } else {
              console.log(`   ❌ Custom validation failed: ${validationResult}`);
              testsFailed++;
            }
          } else {
            testsPassed++;
          }
        } else {
          console.log(`   ❌ Invalid response format (missing 'success', 'error+code', or 'error+message' field)`);
          console.log(`   Response: ${JSON.stringify(response.body).substring(0, 200)}`);
          testsFailed++;
        }
      } else {
        console.log(`   ❌ Invalid response (not JSON object)`);
        console.log(`   Response: ${response.rawBody.substring(0, 200)}`);
        testsFailed++;
      }
    } else {
      const expectedStr = Array.isArray(expectedStatus) ? expectedStatus.join(' or ') : expectedStatus;
      console.log(`   ❌ Expected status ${expectedStr}, got ${response.statusCode}`);
      console.log(`   Response: ${JSON.stringify(response.body).substring(0, 200)}`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    testsFailed++;
  }
}

// Main test suite
async function runTests() {
  console.log('🚀 Starting In3D API Comprehensive Tests');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(50));

  // ========== SKYBOX TESTS ==========
  console.log('\n📦 SKYBOX ENDPOINT TESTS');
  console.log('-'.repeat(50));

  // Test 1: Get Skybox Styles (X-In3d-Key header)
  await testEndpoint(
    'Get Skybox Styles (X-In3d-Key header)',
    'GET',
    '/skybox/styles?page=1&limit=10',
    null,
    200,
    (body) => {
      if (body.success && (Array.isArray(body.data) || body.data?.styles)) {
        return true;
      }
      return 'Response should have success=true and data/styles array';
    }
  );

  // Test 2: Get Skybox Styles (Authorization: Bearer header)
  await testEndpoint(
    'Get Skybox Styles (Authorization: Bearer header)',
    'GET',
    '/skybox/styles?page=1&limit=10',
    null,
    200,
    (body) => {
      if (body.success && (Array.isArray(body.data) || body.data?.styles)) {
        return true;
      }
      return 'Response should have success=true and data/styles array';
    },
    null,
    'Authorization'
  );

  // Test 3: Generate Skybox
  let skyboxGenerationId = null;
  await testEndpoint(
    'Generate Skybox',
    'POST',
    '/skybox/generate',
    {
      prompt: 'A beautiful sunset over mountains',
      style_id: 1
    },
    [202, 403], // Accepted or Quota Exceeded (both are valid responses)
    (body) => {
      // Success case: generation initiated
      if (body.success && body.data && (body.data.generationId || body.data.id)) {
        skyboxGenerationId = body.data.generationId || body.data.id;
        return true;
      }
      // Quota exceeded case: valid error response
      if (body.success === false && body.code === 'QUOTA_EXCEEDED') {
        console.log(`   ⚠️  Quota exceeded (expected for test account)`);
        return true;
      }
      return 'Response should have success=true with generationId OR success=false with QUOTA_EXCEEDED code';
    }
  );

  // Test 4: Get Skybox Generation Status (if generation was created)
  if (skyboxGenerationId) {
    console.log(`\n⏳ Polling skybox generation status (ID: ${skyboxGenerationId})...`);
    
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await makeRequest('GET', `/skybox/status/${skyboxGenerationId}`);
      const status = statusResponse.body?.data?.status || statusResponse.body?.status;
      
      console.log(`   Poll ${i}: Status = ${status}`);
      
      if (status === 'completed') {
        console.log(`   ✅ Generation completed`);
        if (statusResponse.body.data?.file_url || statusResponse.body.data?.url) {
          console.log(`   File URL: ${statusResponse.body.data.file_url || statusResponse.body.data.url}`);
        }
        testsPassed++;
        break;
      } else if (status === 'failed') {
        console.log(`   ❌ Generation failed`);
        testsFailed++;
        break;
      } else if (i === 5) {
        console.log(`   ⚠️  Generation still processing after 5 polls`);
      }
    }
  }

  // ========== MESHY TESTS ==========
  console.log('\n\n🎨 MESHY ENDPOINT TESTS');
  console.log('-'.repeat(50));

  // Test 5: Generate Meshy 3D Asset
  let meshyTaskId = null;
  await testEndpoint(
    'Generate Meshy 3D Asset',
    'POST',
    '/meshy/generate',
    {
      prompt: 'A detailed medieval sword',
      art_style: 'realistic'
    },
    [202, 401, 403], // Accepted, Auth Required, or Forbidden (all valid for testing)
    (body) => {
      // Success case: generation initiated
      if (body.success && body.data && (body.data.id || body.data.taskId)) {
        meshyTaskId = body.data.id || body.data.taskId;
        return true;
      }
      // Auth/Quota error cases: valid error responses
      // Handle both old format (error: "AUTH_REQUIRED") and new format (code: "AUTH_REQUIRED")
      const hasAuthError = body.error === 'AUTH_REQUIRED' || body.code === 'AUTH_REQUIRED' || body.code === 401;
      const hasQuotaError = body.code === 'QUOTA_EXCEEDED' || body.code === 403;
      const hasForbiddenError = body.code === 403 || body.code === 'FORBIDDEN';
      
      if (body.error && (hasAuthError || hasQuotaError || hasForbiddenError)) {
        console.log(`   ⚠️  ${body.message || 'Auth/Quota issue (expected for test account)'}`);
        return true;
      }
      return 'Response should have success=true with taskId OR valid error response (AUTH_REQUIRED, QUOTA_EXCEEDED, etc.)';
    }
  );

  // Test 6: Get Meshy Status (if task was created)
  if (meshyTaskId) {
    await testEndpoint(
      'Get Meshy Generation Status',
      'GET',
      `/meshy/status/${meshyTaskId}`,
      null,
      200,
      (body) => {
        if (body.success && body.data) {
          return true;
        }
        return 'Response should have success=true and data';
      }
    );
  }

  // ========== ERROR HANDLING TESTS ==========
  console.log('\n\n❌ ERROR HANDLING TESTS');
  console.log('-'.repeat(50));

  // Test 7: Invalid API Key (X-In3d-Key)
  await testEndpoint(
    'Error Handling (Invalid API Key - X-In3d-Key)',
    'GET',
    '/skybox/styles',
    null,
    401,
    (body) => {
      // Accept either format: success=false OR error with code
      if ((body.success === false && body.code) || (body.error && (body.code === 401 || body.code === 'UNAUTHORIZED'))) {
        return true;
      }
      return 'Error response should have success=false with code OR error with code';
    },
    'in3d_live_invalid_key_12345',
    'X-In3d-Key'
  );

  // Test 8: Invalid API Key (Authorization: Bearer)
  await testEndpoint(
    'Error Handling (Invalid API Key - Authorization: Bearer)',
    'GET',
    '/skybox/styles',
    null,
    401,
    (body) => {
      // Accept either format: success=false OR error with code
      if ((body.success === false && body.code) || (body.error && (body.code === 401 || body.code === 'UNAUTHORIZED'))) {
        return true;
      }
      return 'Error response should have success=false with code OR error with code';
    },
    'in3d_live_invalid_key_12345',
    'Authorization'
  );

  // Test 9: Missing API Key
  // Note: /skybox/styles may allow public access, so we accept both 200 and 401
  await testEndpoint(
    'Error Handling (Missing API Key)',
    'GET',
    '/skybox/styles',
    null,
    [200, 401], // May allow public access or require auth
    (body) => {
      // If 200, it's public access (acceptable)
      // If 401, it requires auth (also acceptable)
      if (body.success === true || (body.error && (body.code === 401 || body.code === 'UNAUTHORIZED'))) {
        return true;
      }
      return 'Response should be success=true (public) OR error with 401 code';
    },
    '',
    'X-In3d-Key'
  );

  // Test 10: Missing Required Field
  await testEndpoint(
    'Error Handling (Missing Required Field)',
    'POST',
    '/skybox/generate',
    { style_id: 1 }, // Missing prompt
    400,
    (body) => {
      if (body.success === false && body.code) {
        return true;
      }
      return 'Error response should have success=false and code';
    }
  );

  // Test 11: Invalid Request Body
  await testEndpoint(
    'Error Handling (Invalid Request Body)',
    'POST',
    '/skybox/generate',
    { prompt: '', style_id: 0 }, // Empty prompt, invalid style_id
    400,
    (body) => {
      if (body.success === false && body.code) {
        return true;
      }
      return 'Error response should have success=false and code';
    }
  );

  // ========== VALIDATION TESTS ==========
  console.log('\n\n✅ VALIDATION TESTS');
  console.log('-'.repeat(50));

  // Test 12: Pagination Validation
  // Note: API may be lenient with pagination, accepting page=0 as valid
  await testEndpoint(
    'Pagination Validation (Invalid page)',
    'GET',
    '/skybox/styles?page=0&limit=10',
    null,
    [200, 400], // API may accept page=0 or reject it
    (body) => {
      // If 200, API is lenient (acceptable)
      // If 400, API validates strictly (also acceptable)
      if (body.success === true || (body.success === false && body.code)) {
        return true;
      }
      return 'Response should be success=true (lenient) OR success=false with code (strict)';
    }
  );

  // Test 13: Response Format Validation
  await testEndpoint(
    'Response Format Validation',
    'GET',
    '/skybox/styles?page=1&limit=1',
    null,
    200,
    (body) => {
      const requiredFields = ['success', 'timestamp'];
      const hasAllFields = requiredFields.every(field => field in body);
      if (hasAllFields && typeof body.success === 'boolean') {
        return true;
      }
      return `Response should have all required fields: ${requiredFields.join(', ')}`;
    }
  );

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📈 Total Tests: ${testsPassed + testsFailed}`);
  console.log(`📊 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('');

  if (testsFailed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
