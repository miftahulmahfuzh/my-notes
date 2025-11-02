#!/bin/bash

echo "🧪 Testing Template Duplication Fix (Corrected)..."
echo "==============================================="

# Step 1: Use mock authentication exchange endpoint
echo "1. Testing mock authentication..."
AUTH_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/v1/auth/exchange" \
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

  # Step 2: Test built-in templates API (correct endpoint)
  echo "2. Testing built-in templates API..."
  BUILTIN_RESPONSE=$(curl -s -X GET "http://localhost:8080/api/v1/templates/built-in" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  echo "Built-in templates response:"
  echo "$BUILTIN_RESPONSE"
  echo ""

  # Step 3: Test user templates API (should NOT include built-in templates after fix)
  echo "3. Testing user templates API (the critical test)..."
  USER_TEMPLATES_RESPONSE=$(curl -s -X GET "http://localhost:8080/api/v1/templates" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

  echo "User templates response:"
  echo "$USER_TEMPLATES_RESPONSE"
  echo ""

  # Step 4: Analyze the results
  echo "4. Analyzing results..."

  # Count templates using grep
  BUILTIN_COUNT=$(echo "$BUILTIN_RESPONSE" | grep -o '"name":"' | wc -l)
  USER_COUNT=$(echo "$USER_TEMPLATES_RESPONSE" | grep -o '"name":"' | wc -l)

  echo "📊 Results:"
  echo "- Built-in templates found: $BUILTIN_COUNT"
  echo "- User templates found: $USER_COUNT"
  echo ""

  # Check for specific built-in templates in user templates response
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
  if [ "$USER_COUNT" -eq 0 ]; then
    echo "🎉 SUCCESS: Template duplication fix is working!"
    echo "   User templates API returns 0 templates (no user-created templates yet)"
    echo "   Built-in templates are correctly separated"
  elif [ "$USER_COUNT" -lt "$BUILTIN_COUNT" ]; then
    echo "🎉 SUCCESS: Template duplication fix appears to be working!"
    echo "   User templates API is returning fewer templates than built-in API"
  else
    echo "⚠️  WARNING: Template duplication may still be present"
    echo "   User templates API is returning same or more templates than built-in API"
  fi

  # Show template names for verification
  echo ""
  echo "📋 Built-in template names found:"
  echo "$BUILTIN_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sort

  echo ""
  echo "📋 User template names found:"
  echo "$USER_TEMPLATES_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sort

else
  echo "❌ Authentication failed - no token received"
  echo "Response: $AUTH_RESPONSE"
fi

echo ""
echo "==============================================="
echo "🏁 Test completed"