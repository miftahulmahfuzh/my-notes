#!/bin/bash

echo "🧪 Testing Template Duplication Fix..."
echo "===================================="

# Step 1: Get OAuth URL first to start the flow
echo "1. Getting OAuth URL..."
OAUTH_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/v1/auth/google" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "OAuth response:"
echo "$OAUTH_RESPONSE"
echo ""

# Step 2: Use mock authentication callback (simulating successful OAuth)
echo "2. Testing mock authentication..."
AUTH_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/v1/auth/google/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "mock-auth-code",
    "state": "test-state-123"
  }')

echo "Auth response:"
echo "$AUTH_RESPONSE"
echo ""

# Extract token
ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ACCESS_TOKEN" ]; then
  echo "✅ Authentication successful!"
  echo "Token received: ${ACCESS_TOKEN:0:20}..."
  echo ""

  # Step 3: Test built-in templates API (should return built-in templates)
  echo "3. Testing built-in templates API..."
  BUILTIN_RESPONSE=$(curl -s -X GET "http://localhost:8080/api/v1/templates/builtin" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  echo "Built-in templates response:"
  echo "$BUILTIN_RESPONSE"
  echo ""

  # Step 4: Test user templates API (should NOT include built-in templates after fix)
  echo "4. Testing user templates API (the critical test)..."
  USER_TEMPLATES_RESPONSE=$(curl -s -X GET "http://localhost:8080/api/v1/templates" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  echo "User templates response:"
  echo "$USER_TEMPLATES_RESPONSE"
  echo ""

  # Step 5: Analyze the results
  echo "5. Analyzing results..."

  # Count built-in templates (look for template names in response)
  BUILTIN_COUNT=$(echo "$BUILTIN_RESPONSE" | grep -o '"name":"' | wc -l)
  USER_COUNT=$(echo "$USER_TEMPLATES_RESPONSE" | grep -o '"name":"' | wc -l)

  echo "📊 Results:"
  echo "- Built-in templates found: $BUILTIN_COUNT"
  echo "- User templates found: $USER_COUNT"
  echo ""

  # Check if user templates response contains built-in template names
  if echo "$USER_TEMPLATES_RESPONSE" | grep -q '"name":"Meeting Notes"'; then
    echo "❌ ISSUE: 'Meeting Notes' template found in user templates API"
  else
    echo "✅ GOOD: 'Meeting Notes' template NOT found in user templates API"
  fi

  if echo "$USER_TEMPLATES_RESPONSE" | grep -q '"name":"Daily Journal"'; then
    echo "❌ ISSUE: 'Daily Journal' template found in user templates API"
  else
    echo "✅ GOOD: 'Daily Journal' template NOT found in user templates API"
  fi

  echo ""
  if [ "$USER_COUNT" -eq 0 ] || [ "$USER_COUNT" -lt "$BUILTIN_COUNT" ]; then
    echo "🎉 SUCCESS: Template duplication fix appears to be working!"
    echo "   User templates API is returning fewer templates than built-in API"
  else
    echo "⚠️  WARNING: Template duplication may still be present"
    echo "   User templates API is returning same or more templates than built-in API"
  fi

else
  echo "❌ Authentication failed - no token received"
  echo "Response: $AUTH_RESPONSE"
fi

echo ""
echo "===================================="
echo "🏁 Test completed"