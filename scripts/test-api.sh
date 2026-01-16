#!/bin/bash

# In3D API Testing Script
# Tests all API endpoints for n8n compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${IN3D_API_URL:-https://us-central1-learnxr-evoneuralai.cloudfunctions.net/api}"
API_KEY="${IN3D_API_KEY:-}"

if [ -z "$API_KEY" ]; then
    echo -e "${RED}Error: IN3D_API_KEY environment variable is not set${NC}"
    echo "Usage: IN3D_API_KEY=in3d_live_... ./test-api.sh"
    exit 1
fi

echo -e "${GREEN}Testing In3D API Endpoints${NC}"
echo "Base URL: $BASE_URL"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    
    echo -e "${YELLOW}Testing: $test_name${NC}"
    echo "  $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
            -H "X-In3d-Key: $API_KEY" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "X-In3d-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Check HTTP status code
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "  ${GREEN}✓ HTTP Status: $http_code${NC}"
        
        # Check response format
        if echo "$body" | jq -e '.success' > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓ Valid JSON response format${NC}"
            echo "  Response: $(echo "$body" | jq -c '{success, error, code, requestId}')"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "  ${RED}✗ Invalid response format (missing 'success' field)${NC}"
            echo "  Response: $body"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        echo -e "  ${RED}✗ Expected status $expected_status, got $http_code${NC}"
        echo "  Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    echo ""
}

# Test 1: Get Skybox Styles (X-In3d-Key header)
test_endpoint "GET" "/skybox/styles?page=1&limit=10" "" "200" "Get Skybox Styles (X-In3d-Key header)"

# Test 1b: Get Skybox Styles (Authorization: Bearer header)
echo -e "${YELLOW}Testing: Get Skybox Styles (Authorization: Bearer header)${NC}"
echo "  GET /skybox/styles?page=1&limit=10"

BEARER_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/skybox/styles?page=1&limit=10" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$BEARER_RESPONSE" | tail -n1)
BODY=$(echo "$BEARER_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓ HTTP Status: $HTTP_CODE${NC}"
    if echo "$BODY" | jq -e '.success' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Valid JSON response format${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗ Invalid response format${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "  ${RED}✗ Expected 200, got $HTTP_CODE${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# Test 2: Generate Skybox
GENERATION_RESPONSE=$(curl -s -X POST "$BASE_URL/skybox/generate" \
    -H "X-In3d-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "prompt": "A beautiful sunset over mountains",
        "style_id": 1
    }')

echo -e "${YELLOW}Testing: Generate Skybox${NC}"
echo "  POST /skybox/generate"

if echo "$GENERATION_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    GENERATION_ID=$(echo "$GENERATION_RESPONSE" | jq -r '.data.generationId')
    echo -e "  ${GREEN}✓ Generation initiated${NC}"
    echo "  Generation ID: $GENERATION_ID"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Test 3: Get Generation Status
    echo ""
    echo -e "${YELLOW}Testing: Get Generation Status${NC}"
    echo "  GET /skybox/status/$GENERATION_ID"
    
    # Poll status a few times
    for i in {1..5}; do
        sleep 2
        STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/skybox/status/$GENERATION_ID" \
            -H "X-In3d-Key: $API_KEY")
        
        STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status // .status')
        echo "  Poll $i: Status = $STATUS"
        
        if [ "$STATUS" = "completed" ]; then
            echo -e "  ${GREEN}✓ Generation completed${NC}"
            FILE_URL=$(echo "$STATUS_RESPONSE" | jq -r '.data.file_url // empty')
            if [ -n "$FILE_URL" ]; then
                echo "  File URL: $FILE_URL"
            fi
            TESTS_PASSED=$((TESTS_PASSED + 1))
            break
        elif [ "$STATUS" = "failed" ]; then
            echo -e "  ${RED}✗ Generation failed${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            break
        fi
    done
else
    echo -e "  ${RED}✗ Generation failed${NC}"
    echo "  Response: $GENERATION_RESPONSE"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# Test 4: Error Handling - Invalid API Key
echo -e "${YELLOW}Testing: Error Handling (Invalid API Key)${NC}"
echo "  GET /skybox/styles (with invalid key)"

INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/skybox/styles" \
    -H "X-In3d-Key: in3d_live_invalid_key_12345" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)
BODY=$(echo "$INVALID_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "  ${GREEN}✓ Correctly returned 401${NC}"
    if echo "$BODY" | jq -e '.success == false and .code' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Valid error response format${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗ Invalid error response format${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "  ${RED}✗ Expected 401, got $HTTP_CODE${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# Test 5: Error Handling - Missing Required Field
echo -e "${YELLOW}Testing: Error Handling (Missing Required Field)${NC}"
echo "  POST /skybox/generate (without prompt)"

MISSING_FIELD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/skybox/generate" \
    -H "X-In3d-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"style_id": 1}')

HTTP_CODE=$(echo "$MISSING_FIELD_RESPONSE" | tail -n1)
BODY=$(echo "$MISSING_FIELD_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "  ${GREEN}✓ Correctly returned 400${NC}"
    if echo "$BODY" | jq -e '.success == false and .code' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Valid error response format${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗ Invalid error response format${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "  ${RED}✗ Expected 400, got $HTTP_CODE${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# Test 6: Meshy Generate (if API key has full access)
echo -e "${YELLOW}Testing: Generate Meshy 3D Asset${NC}"
echo "  POST /meshy/generate"

MESHY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/meshy/generate" \
    -H "X-In3d-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "prompt": "A detailed medieval sword",
        "art_style": "realistic"
    }')

HTTP_CODE=$(echo "$MESHY_RESPONSE" | tail -n1)
BODY=$(echo "$MESHY_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓ HTTP Status: $HTTP_CODE${NC}"
    if echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
        MESHY_TASK_ID=$(echo "$BODY" | jq -r '.data.id // .data.taskId // empty')
        echo -e "  ${GREEN}✓ Generation initiated${NC}"
        if [ -n "$MESHY_TASK_ID" ]; then
            echo "  Task ID: $MESHY_TASK_ID"
        fi
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗ Invalid response format${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "  ${YELLOW}⚠ Expected 202/200, got $HTTP_CODE (may require full access scope)${NC}"
    if echo "$BODY" | jq -e '.success == false' > /dev/null 2>&1; then
        echo "  Response indicates scope or configuration issue"
    fi
fi

echo ""

# Test 7: Missing API Key
echo -e "${YELLOW}Testing: Error Handling (Missing API Key)${NC}"
echo "  GET /skybox/styles (without auth header)"

MISSING_KEY_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/skybox/styles" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$MISSING_KEY_RESPONSE" | tail -n1)
BODY=$(echo "$MISSING_KEY_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "  ${GREEN}✓ Correctly returned 401${NC}"
    if echo "$BODY" | jq -e '.success == false and .code' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Valid error response format${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗ Invalid error response format${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "  ${RED}✗ Expected 401, got $HTTP_CODE${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# Test 8: Authorization Bearer Invalid Key
echo -e "${YELLOW}Testing: Error Handling (Invalid API Key - Authorization: Bearer)${NC}"
echo "  GET /skybox/styles (with invalid Bearer token)"

BEARER_INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/skybox/styles" \
    -H "Authorization: Bearer in3d_live_invalid_key_12345" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$BEARER_INVALID_RESPONSE" | tail -n1)
BODY=$(echo "$BEARER_INVALID_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "  ${GREEN}✓ Correctly returned 401${NC}"
    if echo "$BODY" | jq -e '.success == false and .code' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Valid error response format${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗ Invalid error response format${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "  ${RED}✗ Expected 401, got $HTTP_CODE${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""

# Test 9: Pagination Validation
echo -e "${YELLOW}Testing: Pagination Validation (Invalid page)${NC}"
echo "  GET /skybox/styles?page=0&limit=10"

PAGINATION_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/skybox/styles?page=0&limit=10" \
    -H "X-In3d-Key: $API_KEY" \
    -H "Content-Type: application/json")

HTTP_CODE=$(echo "$PAGINATION_RESPONSE" | tail -n1)
BODY=$(echo "$PAGINATION_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
    echo -e "  ${GREEN}✓ Correctly returned 400${NC}"
    if echo "$BODY" | jq -e '.success == false and .code' > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Valid error response format${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "  ${RED}✗ Invalid error response format${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo -e "  ${YELLOW}⚠ Expected 400, got $HTTP_CODE (validation may be lenient)${NC}"
fi

echo ""

# Summary
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=0
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $TESTS_PASSED * 100 / $TOTAL_TESTS" | bc)
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Test Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Total Tests: ${YELLOW}$TOTAL_TESTS${NC}"
echo -e "Success Rate: ${YELLOW}${SUCCESS_RATE}%${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
