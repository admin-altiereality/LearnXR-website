/**
 * Script to verify Razorpay plan IDs are from test mode
 * 
 * This script checks if the plan IDs in your .env file are valid
 * and created in Razorpay TEST mode (matching your test API keys).
 * 
 * Usage:
 *   node scripts/verify-razorpay-plans.js
 */

const Razorpay = require('razorpay');
const path = require('path');
const fs = require('fs');

// Load dotenv from multiple possible locations (prioritize client .env)
let envLoaded = false;
const possibleEnvPaths = [
  path.join(__dirname, '..', 'server', 'client', '.env'), // Client .env first (has VITE_ vars)
  path.join(__dirname, '..', 'server', '.env'),           // Server .env (has RAZORPAY_KEY_SECRET)
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', 'functions', '.env'),
  '.env'
];

try {
  const dotenv = require('dotenv');
  
  // Load all .env files to merge values (client .env for VITE_ vars, server .env for secrets)
  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false }); // Don't override, merge
      console.log(`✅ Loaded .env from: ${envPath}`);
      envLoaded = true;
    }
  }
  
  if (!envLoaded) {
    dotenv.config();
    envLoaded = true;
  }
} catch (error) {
  console.error('⚠️  Could not load dotenv:', error.message);
}

// Get Razorpay credentials (check both VITE_ and non-VITE_ versions)
const RAZORPAY_KEY_ID = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('❌ RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env file');
  console.error('   Looking for keys in:', possibleEnvPaths.join(', '));
  process.exit(1);
}

// Determine mode
const isTestMode = RAZORPAY_KEY_ID.startsWith('rzp_test_');
const mode = isTestMode ? 'TEST' : 'LIVE';

console.log('\n' + '='.repeat(60));
console.log('🔍 Verifying Razorpay Plan IDs');
console.log('='.repeat(60));
console.log(`Key ID: ${RAZORPAY_KEY_ID.substring(0, 15)}...`);
console.log(`Mode: ${mode}`);
console.log('='.repeat(60) + '\n');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// Plan IDs to verify (from .env)
const planIdsToVerify = [
  { envKey: 'VITE_RAZORPAY_PRO_MONTHLY_PLAN_ID', name: 'Pro Monthly' },
  { envKey: 'VITE_RAZORPAY_PRO_YEARLY_PLAN_ID', name: 'Pro Yearly' },
  { envKey: 'VITE_RAZORPAY_TEAM_MONTHLY_PLAN_ID', name: 'Team Monthly' },
  { envKey: 'VITE_RAZORPAY_TEAM_YEARLY_PLAN_ID', name: 'Team Yearly' },
  { envKey: 'VITE_RAZORPAY_ENTERPRISE_MONTHLY_PLAN_ID', name: 'Enterprise Monthly' },
  { envKey: 'VITE_RAZORPAY_ENTERPRISE_YEARLY_PLAN_ID', name: 'Enterprise Yearly' }
];

async function verifyPlan(envKey, planName) {
  const planId = process.env[envKey];
  
  if (!planId) {
    return {
      envKey,
      planName,
      status: 'missing',
      message: 'Plan ID not set in .env'
    };
  }
  
  try {
    const plan = await razorpay.plans.fetch(planId);
    
    // Check if plan exists and is valid
    if (plan && plan.id === planId) {
      return {
        envKey,
        planName,
        planId,
        status: 'valid',
        message: `✅ Valid ${mode} mode plan`,
        amount: plan.item.amount / 100, // Convert from paise to rupees
        period: plan.period,
        interval: plan.interval
      };
    } else {
      return {
        envKey,
        planName,
        planId,
        status: 'invalid',
        message: 'Plan ID exists but data mismatch'
      };
    }
  } catch (error) {
    const statusCode = error.statusCode || error.error?.statusCode;
    const errorDescription = error.error?.description || error.description || error.message;
    
    if (statusCode === 404) {
      return {
        envKey,
        planName,
        planId,
        status: 'not_found',
        message: `❌ Plan not found in ${mode} mode (might be in ${isTestMode ? 'LIVE' : 'TEST'} mode)`
      };
    } else if (statusCode === 401 || statusCode === 403) {
      return {
        envKey,
        planName,
        planId,
        status: 'auth_error',
        message: `❌ Authentication failed (${statusCode}) - check API keys match ${mode} mode`
      };
    } else {
      return {
        envKey,
        planName,
        planId,
        status: 'error',
        message: `❌ Error (${statusCode || 'unknown'}): ${errorDescription || error.message || 'Unknown error'}`,
        fullError: error
      };
    }
  }
}

async function verifyAllPlans() {
  console.log('Checking plan IDs...\n');
  
  const results = [];
  
  for (const planInfo of planIdsToVerify) {
    const result = await verifyPlan(planInfo.envKey, planInfo.name);
    results.push(result);
    
    // Display result
    const statusIcon = result.status === 'valid' ? '✅' : 
                      result.status === 'missing' ? '⚠️' : '❌';
    console.log(`${statusIcon} ${planInfo.name}:`);
    console.log(`   ${result.message}`);
    if (result.planId) {
      console.log(`   Plan ID: ${result.planId}`);
    }
    if (result.amount) {
      console.log(`   Amount: ₹${result.amount.toLocaleString('en-IN')}`);
      console.log(`   Period: ${result.period} (${result.interval} ${result.period === 'monthly' ? 'month(s)' : 'year(s)'})`);
    }
    console.log('');
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('📊 Verification Summary\n');
  
  const valid = results.filter(r => r.status === 'valid').length;
  const missing = results.filter(r => r.status === 'missing').length;
  const invalid = results.filter(r => r.status !== 'valid' && r.status !== 'missing').length;
  
  console.log(`✅ Valid plans: ${valid}/${planIdsToVerify.length}`);
  console.log(`⚠️  Missing plans: ${missing}/${planIdsToVerify.length}`);
  console.log(`❌ Invalid/Error plans: ${invalid}/${planIdsToVerify.length}`);
  
  console.log('\n' + '='.repeat(60));
  
  if (valid === planIdsToVerify.length) {
    console.log('✅ All plan IDs are valid and match TEST mode!');
    console.log('   Your setup is correct for preview channel testing.');
  } else if (invalid > 0) {
    console.log('⚠️  Some plan IDs have issues:');
    results.filter(r => r.status !== 'valid').forEach(r => {
      console.log(`   - ${r.planName}: ${r.message}`);
    });
    console.log('\n💡 Solution:');
    if (isTestMode) {
      console.log('   1. Make sure you\'re in TEST mode in Razorpay dashboard');
      console.log('   2. Create plans in TEST mode using: node scripts/create-razorpay-plans.js');
      console.log('   3. Update plan IDs in server/client/.env');
    } else {
      console.log('   1. You\'re using LIVE keys but plans might be in TEST mode');
      console.log('   2. Switch to TEST mode or use LIVE plan IDs');
    }
  } else {
    console.log('⚠️  Some plan IDs are missing from .env file');
    console.log('   Add the missing plan IDs to server/client/.env');
  }
  
  console.log('='.repeat(60) + '\n');
}

// Run verification
verifyAllPlans().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});

