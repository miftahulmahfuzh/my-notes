#!/bin/bash

echo "🧪 Testing Template API Fix..."
echo "================================"

# First test: Built-in templates (should return templates)
echo "1. Testing built-in templates API..."
BUILTIN_RESPONSE=$(curl -s -X GET "http://localhost:8080/api/v1/templates/builtin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token")

echo "Built-in templates response:"
echo "$BUILTIN_RESPONSE" | jq '.' 2>/dev/null || echo "$BUILTIN_RESPONSE"
echo ""

# We need to authenticate first to test user templates
# Let's try with a test user authentication
echo "2. Testing user authentication (test mode)..."
AUTH_RESPONSE=$(curl -s -X POST "http://localhost:8080/api/v1/auth/test-login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}')

echo "Auth response:"
echo "$AUTH_RESPONSE" | jq '.' 2>/dev/null || echo "$AUTH_RESPONSE"

# Extract token if authentication successful
TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.data.token // empty')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "✅ Authentication successful, token received"
  echo ""

  # Second test: User templates (should return empty or user-created only)
  echo "3. Testing user templates API (should NOT include built-in templates)..."
  USER_TEMPLATES_RESPONSE=$(curl -s -X GET "http://localhost:8080/api/v1/templates" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN")

  echo "User templates response:"
  echo "$USER_TEMPLATES_RESPONSE" | jq '.' 2>/dev/null || echo "$USER_TEMPLATES_RESPONSE"

  # Count templates in user templates response
  USER_TEMPLATE_COUNT=$(echo "$USER_TEMPLATES_RESPONSE" | jq '.data.templates | length // 0' 2>/dev/null || echo "0")
  BUILTIN_TEMPLATE_COUNT=$(echo "$BUILTIN_RESPONSE" | jq '.data.templates | length // 0' 2>/dev/null || echo "0")

  echo ""
  echo "📊 Results Summary:"
  echo "- Built-in templates count: $BUILTIN_TEMPLATE_COUNT"
  echo "- User templates count: $USER_TEMPLATE_COUNT"

  if [ "$USER_TEMPLATE_COUNT" -eq 0 ] || [ "$USER_TEMPLATE_COUNT" -lt "$BUILTIN_TEMPLATE_COUNT" ]; then
    echo "✅ FIX SUCCESSFUL: User templates API is not returning built-in templates"
  else
    echo "❌ FIX FAILED: User templates API is still returning built-in templates"
  fi
else
  echo "❌ Authentication failed, cannot test user templates API"
fi

echo ""
echo "================================"
echo "🏁 Test completed"