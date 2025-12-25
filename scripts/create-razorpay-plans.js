/**
 * Script to create all Razorpay subscription plans
 * 
 * This script creates plans for:
 * - Pro (Monthly & Yearly)
 * - Team (Monthly & Yearly)
 * - Enterprise (Monthly & Yearly)
 * 
 * Note: Free plan is not created as Razorpay doesn't support ₹0 plans.
 * Free users are handled in application logic without Razorpay subscriptions.
 * 
 * Usage:
 *   1. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file
 *   2. Run: node scripts/create-razorpay-plans.js
 * 
 * The script will output environment variables to add to your .env files.
 */

const Razorpay = require('razorpay');
const path = require('path');
const fs = require('fs');

// Load dotenv from multiple possible locations
let envLoaded = false;
const possibleEnvPaths = [
  path.join(__dirname, '..', '.env'),           // Root .env
  path.join(__dirname, '..', 'functions', '.env'), // Functions .env
  path.join(__dirname, '..', 'server', '.env'),    // Server .env
  path.join(__dirname, '..', 'server', 'client', '.env'), // Client .env
  '.env'  // Current directory
];

try {
  const dotenv = require('dotenv');
  
  // Try loading from multiple locations
  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`✅ Loaded .env from: ${envPath}`);
      envLoaded = true;
      break;
    }
  }
  
  // Also try default location
  if (!envLoaded) {
    dotenv.config();
    envLoaded = true;
  }
} catch (e) {
  console.log('Note: dotenv not found, using environment variables directly');
}

// Debug: Show where we're looking for env vars
if (!process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_SECRET) {
  console.log('\n🔍 Checking for .env files in:');
  possibleEnvPaths.forEach(p => {
    const exists = fs.existsSync(p);
    console.log(`   ${exists ? '✅' : '❌'} ${p}`);
  });
}

// Initialize Razorpay
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('\n❌ Error: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
  console.error('\nCurrent values:');
  console.error(`   RAZORPAY_KEY_ID: ${RAZORPAY_KEY_ID ? '✅ Set' : '❌ Not set'}`);
  console.error(`   RAZORPAY_KEY_SECRET: ${RAZORPAY_KEY_SECRET ? '✅ Set' : '❌ Not set'}`);
  console.error('\nPlease set them in one of these locations:');
  possibleEnvPaths.forEach(p => {
    console.error(`   - ${p}`);
  });
  console.error('\nOr create a .env file in the root directory with:');
  console.error('RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx');
  console.error('RAZORPAY_KEY_SECRET=your_secret_key_here');
  console.error('\nOr run with environment variables:');
  console.error('$env:RAZORPAY_KEY_ID="xxx"; $env:RAZORPAY_KEY_SECRET="xxx"; node scripts/create-razorpay-plans.js');
  console.error('\nOr on Linux/Mac:');
  console.error('RAZORPAY_KEY_ID=xxx RAZORPAY_KEY_SECRET=xxx node scripts/create-razorpay-plans.js');
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// Plan definitions based on subscriptionService.ts
const PLAN_DEFINITIONS = [
  {
    name: 'Pro Monthly',
    planId: 'pro',
    interval: 'monthly',
    amount: 1200000, // ₹12,000 in paise
    period: 1,
    description: 'Pro plan - 60 generations per month, Commercial rights, API access'
  },
  {
    name: 'Pro Yearly',
    planId: 'pro',
    interval: 'yearly',
    amount: 12000000, // ₹1,20,000 in paise
    period: 12,
    description: 'Pro plan - 60 generations per month, Commercial rights, API access (Yearly)'
  },
  {
    name: 'Team Monthly',
    planId: 'team',
    interval: 'monthly',
    amount: 2500000, // ₹25,000 in paise
    period: 1,
    description: 'Team plan - 120 generations per month, Team collaboration, Priority support'
  },
  {
    name: 'Team Yearly',
    planId: 'team',
    interval: 'yearly',
    amount: 25000000, // ₹2,50,000 in paise
    period: 12,
    description: 'Team plan - 120 generations per month, Team collaboration, Priority support (Yearly)'
  },
  {
    name: 'Enterprise Monthly',
    planId: 'enterprise',
    interval: 'monthly',
    amount: 5000000, // ₹50,000 in paise (placeholder - adjust for custom pricing)
    period: 1,
    description: 'Enterprise plan - Custom quota, Dedicated support'
  },
  {
    name: 'Enterprise Yearly',
    planId: 'enterprise',
    interval: 'yearly',
    amount: 50000000, // ₹5,00,000 in paise (placeholder - adjust for custom pricing)
    period: 12,
    description: 'Enterprise plan - Custom quota, Dedicated support (Yearly)'
  }
];

const createdPlans = [];

async function createPlan(planDef) {
  try {
    console.log(`\n📦 Creating: ${planDef.name}...`);
    
    const planData = {
      period: planDef.interval, // 'monthly' or 'yearly'
      interval: planDef.period, // 1 for monthly, 12 for yearly
      item: {
        name: planDef.name,
        amount: planDef.amount,
        currency: 'INR',
        description: planDef.description
      },
      notes: {
        planId: planDef.planId,
        interval: planDef.interval,
        internalName: `${planDef.planId}_${planDef.interval}`
      }
    };

    const plan = await razorpay.plans.create(planData);
    
    console.log(`✅ Created: ${planDef.name}`);
    console.log(`   Plan ID: ${plan.id}`);
    console.log(`   Amount: ₹${(planDef.amount / 100).toLocaleString('en-IN')}`);
    console.log(`   Period: ${planDef.period} ${planDef.period === 1 ? 'month' : 'months'}`);

    return {
      planId: planDef.planId,
      interval: planDef.interval,
      razorpayPlanId: plan.id,
      name: planDef.name,
      amount: planDef.amount
    };
  } catch (error) {
    console.error(`❌ Error creating ${planDef.name}:`, error.message);
    if (error.error) {
      console.error(`   Details:`, JSON.stringify(error.error, null, 2));
    }
    if (error.statusCode) {
      console.error(`   Status Code: ${error.statusCode}`);
    }
    return null;
  }
}

async function createAllPlans() {
  console.log('🚀 Creating Razorpay Subscription Plans...\n');
  console.log('='.repeat(60));
  console.log(`✅ Razorpay credentials found`);
  console.log(`   Key ID: ${RAZORPAY_KEY_ID.substring(0, 12)}...`);
  console.log(`   Mode: ${RAZORPAY_KEY_ID.startsWith('rzp_test_') ? 'TEST' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Create all plans
  for (const planDef of PLAN_DEFINITIONS) {
    const created = await createPlan(planDef);
    if (created) {
      createdPlans.push(created);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Display summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary\n');
  
  if (createdPlans.length === 0) {
    console.log('⚠️  No plans were created. Check errors above.');
    return;
  }

  console.log(`✅ Successfully created ${createdPlans.length} plans:\n`);

  // Group by plan type
  const grouped = createdPlans.reduce((acc, plan) => {
    if (!acc[plan.planId]) {
      acc[plan.planId] = [];
    }
    acc[plan.planId].push(plan);
    return acc;
  }, {});

  // Display environment variables format
  console.log('📝 Environment Variables to Add:\n');
  console.log('# Client Environment Variables (server/client/.env)');
  console.log('# Copy these to your server/client/.env file:\n');
  
  for (const [planId, plans] of Object.entries(grouped)) {
    const monthly = plans.find(p => p.interval === 'monthly');
    const yearly = plans.find(p => p.interval === 'yearly');
    
    if (monthly) {
      const envKey = `VITE_RAZORPAY_${planId.toUpperCase()}_MONTHLY_PLAN_ID`;
      console.log(`${envKey}=${monthly.razorpayPlanId}`);
    }
    if (yearly) {
      const envKey = `VITE_RAZORPAY_${planId.toUpperCase()}_YEARLY_PLAN_ID`;
      console.log(`${envKey}=${yearly.razorpayPlanId}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Plan creation complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Copy the environment variables above');
  console.log('2. Add them to server/client/.env file');
  console.log('3. Restart your development server');
  console.log('4. Test subscription creation in your app');
  console.log('\n💡 Note: Free plan (₹0) is not created as Razorpay doesn\'t support zero-amount plans.');
  console.log('   Free users are handled in your application logic.');
}

// Run the script
createAllPlans()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

