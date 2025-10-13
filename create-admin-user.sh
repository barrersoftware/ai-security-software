#!/bin/bash

API_URL="http://localhost:3001"
ADMIN_USER="admin_$(date +%s)"
ADMIN_EMAIL="admin_$(date +%s)@example.com"
ADMIN_PASSWORD="AdminPass123!@#"

echo "Creating admin user..."
echo "Username: $ADMIN_USER"
echo "Email: $ADMIN_EMAIL"
echo ""

# Register admin user
echo "1. Registering user..."
RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"role\":\"admin\"}")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Login to get token
echo "2. Logging in..."
RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "✅ Admin user created successfully!"
    echo ""
    echo "Admin Token: $TOKEN"
    echo ""
    echo "Save this for testing:"
    echo "export ADMIN_TOKEN=\"$TOKEN\""
    echo ""
    
    # Save to file
    echo "ADMIN_USER=\"$ADMIN_USER\"" > .admin-credentials
    echo "ADMIN_TOKEN=\"$TOKEN\"" >> .admin-credentials
    echo ""
    echo "Credentials saved to .admin-credentials"
else
    echo "❌ Failed to create admin user"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi
