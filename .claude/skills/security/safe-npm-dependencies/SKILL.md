---
name: safe-npm-dependencies
description: Use when installing, updating, or auditing npm dependencies - prevents supply chain attacks by enforcing security checks before any npm install, using npm ci instead of npm install, validating lockfiles, and checking for malicious packages
---

# Safe npm Dependencies

## Overview

**npm install is a remote code execution primitive, not a harmless convenience.**

The Shai-Hulud attacks (2025) compromised 796+ packages affecting 20M+ weekly downloads. This skill enforces security checks before ANY dependency operation.

## The Iron Law

```
NEVER run `npm install <package>` without security checks first.
NEVER skip lockfile validation.
ALWAYS use `npm ci` in CI/CD and fresh environments.
```

## When to Use

**ALWAYS use when:**
- Installing new dependencies
- Updating existing dependencies
- Setting up a new environment
- Running in CI/CD pipelines
- User asks to "add", "install", or "update" any package

**Red flags to watch for:**
- `npm install` without `--ignore-scripts`
- Installing packages without version pinning
- Skipping lockfile validation
- "It's a popular package, so it's safe"

## Quick Reference

| Scenario | Command |
|----------|---------|
| Check new package | `scripts/check-package.sh <package> [version]` |
| Fresh install | `npm ci --ignore-scripts` |
| Add new package | Check first, then `npm install pkg@x.y.z --save-exact --ignore-scripts` |
| Update package | `npm update pkg` after reviewing changelog |
| Audit | `npm audit --audit-level=high` |
| Validate lockfile | `npx lockfile-lint --type npm --path package-lock.json --validate-https --allowed-hosts npm` |

## Before Installing ANY New Package

**Run the security check script:**

```bash
scripts/check-package.sh <package-name> [version]
```

The script performs all mandatory checks automatically:
- Package age and publish timeline
- Weekly download count (flags < 1000)
- Install scripts detection (preinstall/install/postinstall)
- Maintainer information
- Dependency count
- Typosquatting hints (homepage, repository)

**Exit codes:**
- `0` - No issues detected, safe to install
- `1` - Warnings found, review before installing
- `2` - Red flags found, do NOT install without investigation

**After the script passes**, install with safety flags:
```bash
npm install <package>@<exact-version> --save-exact --ignore-scripts
```

**After installation**, validate lockfile and audit:
```bash
npx lockfile-lint --type npm --path package-lock.json --validate-https --allowed-hosts npm
npm audit --audit-level=high
```

## Project Setup (Do Once)

Create `.npmrc` in project root:
```ini
ignore-scripts=true
package-lock=true
strict-ssl=true
audit-level=high
save-exact=true
```

This provides baseline protection for the entire team.

## CI/CD Security

**Always use:**
```bash
npm ci --ignore-scripts
```

**Never use:**
```bash
npm install  # Can modify lockfile, runs scripts
```

## Common Rationalizations (ALL WRONG)

| Excuse | Reality |
|--------|---------|
| "It's a popular package" | Shai-Hulud compromised popular packages |
| "npm audit shows no issues" | npm audit only checks known CVEs, not malicious code |
| "It's just a dev dependency" | Dev deps run with full privileges |
| "I'll check it later" | Attack happens at install time |
| "The user just wants it installed" | User wants SAFE installation |

## When User Says "Just Install It"

**DO NOT** blindly comply. Instead:

1. Run the security checks above
2. Report any concerns to the user
3. If clean, install with safety flags
4. If suspicious, explain the risk and ask for confirmation

Your job is to protect the user, not to execute commands blindly.

## Red Flags - STOP and Investigate

- Package published < 7 days ago
- Package has < 1000 weekly downloads (unless niche)
- Install scripts present without clear justification
- Non-HTTPS registry sources in lockfile
- Package name similar to popular package (typosquatting)

## Summary

1. **Check before install** - metadata, scripts, popularity
2. **Use safety flags** - `--save-exact --ignore-scripts`
3. **Validate lockfile** - after every dependency change
4. **Use npm ci** - in CI/CD and fresh environments
5. **Audit regularly** - `npm audit --audit-level=high`

The extra 30 seconds of checks prevents supply chain compromise.
