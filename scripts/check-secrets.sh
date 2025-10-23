#!/bin/bash

# 🔒 Security Check Script - Scan for sensitive information
# This script scans for potential secrets and sensitive data before commits

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

FOUND_SECRETS=0

echo "🔍 Scanning for sensitive information..."
echo ""

# Patterns to search for
declare -A PATTERNS=(
    ["API Keys"]="(sk|pk|api|token|secret)[_-]?[a-zA-Z0-9]{20,}"
    ["JWT Secrets"]="jwt[_-]?secret[\s:=]+['\"]?[a-zA-Z0-9+/=]{32,}['\"]?"
    ["Passwords"]="password[\s:=]+['\"]?[^\s'\"]{8,}['\"]?"
    ["Private Keys"]="-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"
    ["AWS Keys"]="AKIA[0-9A-Z]{16}"
    ["Database URLs"]="(mongodb|mysql|postgres|redis)://[^\s'\"]+"
    ["IP Addresses (Private)"]="(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)\d{1,3}\.\d{1,3}"
    ["Bearer Tokens"]="Bearer [a-zA-Z0-9_\-\.]{20,}"
)

# Files to exclude from scanning
EXCLUDE_PATTERNS=(
    "node_modules/"
    ".git/"
    "*.log"
    "*.min.js"
    "*.map"
    "package-lock.json"
    "dist/"
    "build/"
    "coverage/"
    ".env.example"
    ".env.docker.example"
    "check-secrets.sh"
    "SECURITY.md"
)

# Build exclude arguments for find
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS -not -path '*/$pattern*'"
done

# Function to check a file
check_file() {
    local file=$1
    local found_in_file=0
    
    for pattern_name in "${!PATTERNS[@]}"; do
        pattern="${PATTERNS[$pattern_name]}"
        
        if grep -qiE "$pattern" "$file" 2>/dev/null; then
            if [ $found_in_file -eq 0 ]; then
                echo -e "${RED}⚠️  Found potential secrets in: $file${NC}"
                found_in_file=1
                FOUND_SECRETS=1
            fi
            echo -e "${YELLOW}   - Potential $pattern_name detected${NC}"
        fi
    done
}

# Scan all tracked files
echo "Scanning tracked files..."
git ls-files | while read -r file; do
    # Skip binary files
    if file "$file" 2>/dev/null | grep -q "text"; then
        check_file "$file"
    fi
done

# Check for specific dangerous files
echo ""
echo "Checking for dangerous files..."

DANGEROUS_FILES=(
    "data/init.json"
    ".env"
    ".env.local"
    ".env.production"
    "config/config.js"
    "redis_data/"
)

for danger_file in "${DANGEROUS_FILES[@]}"; do
    if git ls-files | grep -q "^$danger_file"; then
        echo -e "${RED}🚨 CRITICAL: $danger_file is tracked in git!${NC}"
        echo -e "${YELLOW}   This file may contain sensitive data and should be in .gitignore${NC}"
        FOUND_SECRETS=1
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FOUND_SECRETS -eq 0 ]; then
    echo -e "${GREEN}✅ No obvious secrets or sensitive data detected${NC}"
    echo -e "${GREEN}✅ Safe to commit${NC}"
    exit 0
else
    echo -e "${RED}❌ Potential secrets or sensitive data found!${NC}"
    echo ""
    echo "⚠️  WARNING: Review the findings above before committing"
    echo ""
    echo "If these are false positives, you can:"
    echo "  1. Add to .gitignore if they're files"
    echo "  2. Remove sensitive data and use environment variables"
    echo "  3. Add exceptions to this script if legitimate"
    echo ""
    echo "To skip this check (NOT RECOMMENDED):"
    echo "  git commit --no-verify"
    echo ""
    exit 1
fi
