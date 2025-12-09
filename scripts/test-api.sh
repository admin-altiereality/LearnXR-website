#!/bin/bash

# Firebase Functions API Test Script
BASE_URL="https://api-k2khuruyuq-uc.a.run.app"

echo "🧪 Testing Firebase Functions API..."
echo "=================================="

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth_header=$4
    
    echo "Testing $method $endpoint..."
    
    if [ "$method" = "GET" ]; then
        if [ -n "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -H "Authorization: $auth_header" "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
        fi
    else
        if [ -n "$auth_header" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method -H "Content-Type: application/json" -H "Authorization: $auth_header" -d "$data" "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
        fi
    fi
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    # Extract response body (all lines except last)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" -eq 200 ] || [ "$status_code" -eq 201 ]; then
        echo "✅ Success ($status_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        echo "❌ Failed ($status_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    echo ""
}

# Test 1: Health Check
test_endpoint "GET" "/api/health"

# Test 2: Environment Check
test_endpoint "GET" "/api/env-check"

# Test 3: Skybox Styles
test_endpoint "GET" "/api/skybox/styles?page=1&limit=5"

# Test 4: Skybox Generation (without auth - should work as public endpoint)
test_endpoint "POST" "/api/skybox/generate" '{
    "prompt": "A beautiful sunset over mountains",
    "style_id": "test_style_123",
    "userId": "test_user_123"
}'

# Test 5: Skybox Status (with invalid ID - should return 404)
test_endpoint "GET" "/api/skybox/status/invalid_generation_id"

# Test 6: Payment Order Creation
test_endpoint "POST" "/api/payment/create-order" '{
    "amount": 1000,
    "currency": "INR",
    "receipt": "test_receipt_123",
    "userId": "test_user_123"
}'

# Test 7: Subscription Status Check
test_endpoint "POST" "/api/user/subscription-status" '{
    "userId": "test_user_123"
}'

echo "🎉 API testing complete!"
echo ""
echo "📊 Summary:"
echo "- Health check: Should return 200"
echo "- Environment check: Should return 200 with service status"
echo "- Skybox styles: Should return 200 with styles array"
echo "- Skybox generation: Should return 200 with generation ID"
echo "- Skybox status (invalid): Should return 404"
echo "- Payment order: Should return 200 with order details"
echo "- Subscription status: Should return 200 with subscription info"
echo ""
echo "🔍 Next steps:"
echo "1. Check Firebase Functions logs: firebase functions:log"
echo "2. Set up environment variables: firebase functions:secrets:set"
echo "3. Test with real authentication tokens"
echo "4. Verify Firestore rules are working" 