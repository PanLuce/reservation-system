#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <package-name> [version]"
    echo ""
    echo "Performs security checks on an npm package before installation."
    echo ""
    echo "Arguments:"
    echo "  package-name    Name of the npm package to check"
    echo "  version         Optional specific version to check (default: latest)"
    echo ""
    echo "Example:"
    echo "  $0 lodash"
    echo "  $0 express 4.18.2"
    exit 1
}

if [[ $# -lt 1 ]]; then
    usage
fi

PACKAGE="$1"
VERSION="${2:-latest}"
PACKAGE_SPEC="$PACKAGE"
[[ "$VERSION" != "latest" ]] && PACKAGE_SPEC="$PACKAGE@$VERSION"

RED_FLAGS=0
WARNINGS=0

echo "════════════════════════════════════════════════════════════════"
echo "  NPM Package Security Check: $PACKAGE_SPEC"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if package exists
if ! npm view "$PACKAGE_SPEC" name &>/dev/null; then
    echo -e "${RED}ERROR: Package '$PACKAGE_SPEC' not found on npm registry${NC}"
    exit 1
fi

# Get actual version being checked
ACTUAL_VERSION=$(npm view "$PACKAGE_SPEC" version 2>/dev/null)
echo "Version: $ACTUAL_VERSION"
echo ""

# 1. Check package age
echo "─────────────────────────────────────────────────────────────────"
echo "  Package Timeline"
echo "─────────────────────────────────────────────────────────────────"

TIME_JSON=$(npm view "$PACKAGE" time --json 2>/dev/null || echo "{}")
CREATED=$(echo "$TIME_JSON" | grep -E '^\s*"[0-9]+\.' | head -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' || echo "unknown")
VERSION_TIME=$(echo "$TIME_JSON" | grep "\"$ACTUAL_VERSION\"" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' || echo "unknown")

echo "First published: $CREATED"
echo "This version:    $VERSION_TIME"

# Check if version was published within last 7 days
if [[ "$VERSION_TIME" != "unknown" ]]; then
    VERSION_DATE=$(echo "$VERSION_TIME" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
    if [[ -n "$VERSION_DATE" ]]; then
        DAYS_AGO=$(( ($(date +%s) - $(date -j -f "%Y-%m-%d" "$VERSION_DATE" +%s 2>/dev/null || date -d "$VERSION_DATE" +%s 2>/dev/null || echo 0)) / 86400 ))
        if [[ $DAYS_AGO -lt 7 && $DAYS_AGO -ge 0 ]]; then
            echo -e "${YELLOW}⚠ WARNING: Version published $DAYS_AGO days ago (< 7 days)${NC}"
            ((WARNINGS++))
        fi
    fi
fi
echo ""

# 2. Check weekly downloads
echo "─────────────────────────────────────────────────────────────────"
echo "  Popularity"
echo "─────────────────────────────────────────────────────────────────"

DOWNLOADS=$(curl -s "https://api.npmjs.org/downloads/point/last-week/$PACKAGE" | grep -oE '"downloads":[0-9]+' | grep -oE '[0-9]+' || echo "0")
echo "Weekly downloads: $DOWNLOADS"

if [[ "$DOWNLOADS" -lt 1000 ]]; then
    echo -e "${YELLOW}⚠ WARNING: Low download count (<1000/week) - verify this is the intended package${NC}"
    ((WARNINGS++))
fi
echo ""

# 3. Check for install scripts (CRITICAL)
echo "─────────────────────────────────────────────────────────────────"
echo "  Install Scripts (CRITICAL)"
echo "─────────────────────────────────────────────────────────────────"

SCRIPTS=$(npm view "$PACKAGE_SPEC" scripts 2>/dev/null || echo "{}")

HAS_PREINSTALL=$(echo "$SCRIPTS" | grep -i "preinstall" || true)
HAS_INSTALL=$(echo "$SCRIPTS" | grep -i "'install'" || echo "$SCRIPTS" | grep -i '"install"' || true)
HAS_POSTINSTALL=$(echo "$SCRIPTS" | grep -i "postinstall" || true)

if [[ -n "$HAS_PREINSTALL" || -n "$HAS_INSTALL" || -n "$HAS_POSTINSTALL" ]]; then
    echo -e "${RED}🚨 RED FLAG: Package has install scripts!${NC}"
    echo ""
    echo "Scripts found:"
    [[ -n "$HAS_PREINSTALL" ]] && echo -e "  ${RED}• preinstall${NC}"
    [[ -n "$HAS_INSTALL" ]] && echo -e "  ${RED}• install${NC}"
    [[ -n "$HAS_POSTINSTALL" ]] && echo -e "  ${RED}• postinstall${NC}"
    echo ""
    echo "These scripts run automatically during npm install with full system access."
    echo "Investigate the package source before proceeding."
    ((RED_FLAGS++))
else
    echo -e "${GREEN}✓ No install scripts detected${NC}"
fi
echo ""

# 4. Check all scripts
echo "─────────────────────────────────────────────────────────────────"
echo "  All Package Scripts"
echo "─────────────────────────────────────────────────────────────────"

if [[ "$SCRIPTS" == "{}" || -z "$SCRIPTS" ]]; then
    echo "No scripts defined"
else
    echo "$SCRIPTS"
fi
echo ""

# 5. Check maintainers
echo "─────────────────────────────────────────────────────────────────"
echo "  Maintainers"
echo "─────────────────────────────────────────────────────────────────"

npm view "$PACKAGE" maintainers 2>/dev/null || echo "Unable to fetch maintainers"
echo ""

# 6. Check dependencies count
echo "─────────────────────────────────────────────────────────────────"
echo "  Dependencies"
echo "─────────────────────────────────────────────────────────────────"

DEPS=$(npm view "$PACKAGE_SPEC" dependencies 2>/dev/null || echo "{}")
DEP_COUNT=$(echo "$DEPS" | grep -c ":" 2>/dev/null || true)
[[ -z "$DEP_COUNT" ]] && DEP_COUNT=0
echo "Direct dependencies: $DEP_COUNT"

if [[ "$DEP_COUNT" -gt 20 ]]; then
    echo -e "${YELLOW}⚠ WARNING: High dependency count - larger attack surface${NC}"
    ((WARNINGS++))
fi
echo ""

# 7. Typosquatting check reminder
echo "─────────────────────────────────────────────────────────────────"
echo "  Typosquatting Check"
echo "─────────────────────────────────────────────────────────────────"
echo "Verify this is the correct package:"
echo "  • Does the name match official documentation exactly?"
echo "  • Common typosquats: lodash vs 1odash, express vs expresss"
HOMEPAGE=$(npm view "$PACKAGE" homepage 2>/dev/null || echo "Not specified")
REPO=$(npm view "$PACKAGE" repository.url 2>/dev/null || echo "Not specified")
echo "  • Homepage: $HOMEPAGE"
echo "  • Repository: $REPO"
echo ""

# Summary
echo "════════════════════════════════════════════════════════════════"
echo "  SUMMARY"
echo "════════════════════════════════════════════════════════════════"

if [[ $RED_FLAGS -gt 0 ]]; then
    echo -e "${RED}🚨 RED FLAGS: $RED_FLAGS${NC}"
    echo -e "${RED}   DO NOT install without investigating the package source!${NC}"
fi

if [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}⚠ WARNINGS: $WARNINGS${NC}"
fi

if [[ $RED_FLAGS -eq 0 && $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}✓ No issues detected${NC}"
fi

echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "  Recommended Install Command"
echo "─────────────────────────────────────────────────────────────────"

if [[ $RED_FLAGS -gt 0 ]]; then
    echo -e "${RED}⛔ Installation NOT recommended until red flags are resolved${NC}"
else
    echo "npm install $PACKAGE@$ACTUAL_VERSION --save-exact --ignore-scripts"
fi
echo ""

# Exit code based on findings
if [[ $RED_FLAGS -gt 0 ]]; then
    exit 2
elif [[ $WARNINGS -gt 0 ]]; then
    exit 1
else
    exit 0
fi
