---
name: biome
description: Use this skill for code quality checks and fixes using Biome CLI. Trigger when user requests linting, formatting, code quality checks, fixing code issues, or mentions Biome. ALSO trigger automatically after any agent code changes to verify code quality. Handles auto-fixes via CLI and manual fixes for rules that require documentation review.
---

# Biome Code Quality Skill

Use when:

- User asks to check/lint/format code with Biome
- User wants to fix linting/formatting errors
- User mentions Biome explicitly
- Code quality issues need fixing
- User explicitly requests to change Biome rule configuration (disable/enable rules, change severity levels)
- Automatically after any agent code changes (file creation, modification, or refactoring) to verify code quality

DO NOT use for:

- General code review (use code-reviewer agent)
- Type checking (use TypeScript compiler)
- Test writing (use test-engineer agent)
- Changing rules to avoid fixing code violations (fix code instead)

## Core Workflow

**1. Auto-Fix First (Priority)**

```bash
# Check and fix all issues
npx @biomejs/biome check --write .

# Or specific files
npx @biomejs/biome check --write path/to/file.ts

# Only lint (no format)
npx @biomejs/biome lint --write path/to/file.ts

# Only format
npx @biomejs/biome format --write path/to/file.ts
```

**2. Manual Fix Loop**
For issues auto-fix cannot resolve:

```
READ output → IDENTIFY rule → FETCH rule docs → APPLY manual fix → VERIFY
```

## CRITICAL: Fix Code, Not Rules

**WHEN FIXING CODE DUE TO A RULE VIOLATION:**

- ✅ **DO:** Fix the code to comply with the rule
- ✅ **DO:** Refactor code to pass the validation
- ✅ **DO:** Apply the pattern shown in rule documentation
- ❌ **DO NOT:** Disable or suppress the rule
- ❌ **DO NOT:** Modify biome.json to ignore the rule
- ❌ **DO NOT:** Add ignore comments unless explicitly requested by user
- ❌ **DO NOT:** Change rule configuration to make code pass

**The goal is code quality improvement, not rule avoidance.**

## Modifying Rule Configuration

**ONLY when user EXPLICITLY requests to change rule configuration:**

### Process for Rule Configuration Changes

1. **Fetch Rule Documentation First**

   - Use WebFetch to get complete rule information from biomejs.dev
   - URL format: `https://biomejs.dev/linter/rules/[rule-name]`
   - WebFetch prompt:

   ```
   Extract from this Biome rule documentation:
   1. Rule purpose and what it catches
   2. Available configuration options (if any)
   3. Valid values for rule level (error, warn, off)
   4. Configuration schema and examples
   5. Any specific options this rule accepts
   ```

2. **Analyze Rule Behavior**

   - Understand what the rule does and why
   - Check what configuration options are available
   - Verify the requested change is supported by the rule

3. **Modify biome.json**

   - Locate the rule in the appropriate category (complexity, correctness, nursery, security, style, suspicious)
   - Check if rule is in an override section for specific file patterns
   - Apply the change with proper JSON syntax
   - Common rule levels: `"error"`, `"warn"`, `"off"`
   - For rules with options: `{"level": "error", "options": {...}}`

4. **Handle Unsupported Changes**
   - If the requested configuration is not documented, tell the user it's not supported
   - If the behavior they want doesn't exist, explain what the rule actually does
   - Suggest alternatives if available

### Example Rule Modification Workflow

```typescript
// User asks: "Disable the noConsole rule"

1. Fetch docs: WebFetch https://biomejs.dev/linter/rules/no-console
2. Analyze: Rule prevents console.* usage, can be "error", "warn", or "off"
3. Modify biome.json:
   "suspicious": {
     "noConsole": "off"  // Changed from "error" to "off"
   }
4. Verify: Run `biome check` to confirm change works
```

### Important Notes

- **Only modify biome.json when user explicitly asks** - e.g., "disable noConsole", "change noVar to warning", "turn off noExplicitAny"
- **Always fetch docs first** - Never guess rule configuration options
- **Respect existing structure** - Maintain override sections and file pattern specificity
- **Document unsupported requests** - If docs don't show the option, it doesn't exist

## Rule Documentation Pattern

**ALWAYS fetch live docs using WebFetch from biomejs.dev**

**URL format:** `https://biomejs.dev/linter/rules/[rule-name]`

Examples:

- `noDebugger` → https://biomejs.dev/linter/rules/no-debugger
- `useConst` → https://biomejs.dev/linter/rules/use-const
- `noUnusedVariables` → https://biomejs.dev/linter/rules/no-unused-variables

**Convert rule name to URL:**

- camelCase → kebab-case
- Example: `noConsoleLog` → `no-console-log`

**WebFetch prompt for rule docs:**

```
Extract from this Biome rule documentation:
1. Rule purpose and what it catches
2. Incorrect code examples
3. Correct code examples
4. Safe vs unsafe fix guidance if mentioned
Focus on practical patterns for fixing violations.
```

## Execution Checklist

### For Code Quality Fixes (default workflow):

- [ ] Run auto-fix: `biome check --write [files]`
- [ ] Verify results: `biome check [files]`
- [ ] If issues remain:
  - [ ] Extract rule name from output
  - [ ] Fetch rule documentation via WebFetch
  - [ ] Read incorrect/correct examples
  - [ ] Apply manual fix to code
  - [ ] Re-run verification
- [ ] Report results to user

### For Rule Configuration Changes (only when explicitly requested):

- [ ] Confirm user wants to change rule configuration (not fix code)
- [ ] Fetch rule documentation from biomejs.dev
- [ ] Analyze available configuration options
- [ ] Read biome.json to locate rule
- [ ] Verify requested change is supported
- [ ] Apply change to biome.json
- [ ] Run `biome check` to verify configuration works
- [ ] If unsupported, explain why and suggest alternatives

## Error Output Format

Biome reports errors like:

```
src/file.ts:42:5 lint/correctness/noUnusedVariables
  ✖ This variable is unused

  40 | function example() {
  41 |   const value = 5;
> 42 |   const unused = 10;
     |         ^^^^^^
  43 |   return value;
  44 | }
```

Extract:

- **File:** `src/file.ts`
- **Line:** `42`
- **Rule:** `correctness/noUnusedVariables` → `no-unused-variables`
- **Issue:** Variable `unused` is declared but never used

## Configuration Reference

Biome reads `biome.json`:

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true
  }
}
```

User can customize rules per project. Always respect project config.

## Best Practices

1. **Fix code, not rules** - Always fix code to comply with rules; never disable rules or modify configuration to avoid violations
2. **Distinguish between workflows**:
   - Code violations → Fix the code (default)
   - User explicitly requests rule change → Fetch docs, then modify biome.json
3. **Always try auto-fix first** - Saves time, tokens
4. **Batch operations** - Fix all files at once when possible
5. **Verify incrementally** - Check after each manual fix
6. **Report clearly** - Tell user what was fixed, what remains
7. **Use specific paths** - Avoid unnecessary file processing
8. **Read docs for patterns** - Don't guess manual fixes or configuration options

## Token Efficiency

- Use auto-fix for 90% of issues (single command)
- Fetch docs only for unresolved rules
- Fix multiple instances of same rule together
- Report progress concisely

## Documentation Sources

**All references fetched live from biomejs.dev:**

- Main linter: https://biomejs.dev/linter/
- Specific rule: https://biomejs.dev/linter/rules/[rule-name]

No static reference files - always use current online docs via WebFetch.
